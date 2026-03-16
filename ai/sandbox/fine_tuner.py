import torch
from pathlib import Path
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding,
)
from peft import get_peft_model, LoraConfig, TaskType
from datasets import Dataset
from config import PoisonAIConfig


class SandboxFineTuner:
    """
    Fine-tunes a throwaway model with the user's data.
    The model is intentionally exposed to all data — including poison.
    We keep ALL intermediate state for later analysis.
    """

    def __init__(self, cfg: PoisonAIConfig, dataset: Dataset, num_labels: int):
        self.cfg = cfg
        self.dataset = dataset
        self.num_labels = num_labels
        model_path = cfg.base_model

        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.base_model = AutoModelForSequenceClassification.from_pretrained(
            model_path,
            num_labels=num_labels,
            trust_remote_code=cfg.trust_remote_code,
        )

        # --- LoRA keeps fine-tuning fast & cheap ---
        if cfg.use_lora:
            lora_cfg = LoraConfig(
                task_type=TaskType.SEQ_CLS,
                r=cfg.lora_r,
                lora_alpha=cfg.lora_alpha,
                lora_dropout=0.1,
                target_modules=self._get_target_modules(model_path),   # adjust per architecture
            )
            self.model = get_peft_model(self.base_model, lora_cfg)
        else:
            self.model = self.base_model

        # ---------- bookkeeping for later analysis ----------
        self.training_losses_per_sample: list[dict] = []
    def _get_target_modules(self, model_path:str)-> list[str]:
        """Determine LoRA target modules based on model architecture."""
        model_name = Path(model_path).name.lower()
        if "distilbert" in model_name:
            return ["q_lin", "v_lin"]
        elif "bert" in model_name:
            return ["query", "value"]
        elif "bart" in model_name:
            return ["q_proj", "v_proj"]
        elif "gpt" in model_name:
            return ["c_attn"]
        else:
            return ["q_proj", "v_proj"]
        
    # -------- tokenisation --------
    def _tokenize(self, dataset: Dataset) -> Dataset:
        def tok(batch):
            return self.tokenizer(
                batch[self.cfg.text_column],
                padding="max_length",
                truncation=True,
                max_length=self.cfg.max_seq_length,
            )
        
        # Tokenize and remove ALL original string columns to prevent PyTorch tensor stacking errors
        columns_to_remove = dataset.column_names
        tokenized = dataset.map(tok, batched=True, remove_columns=columns_to_remove)
        
        # If there's a label column, we need to map it back as 'labels' since we just removed it
        if self.cfg.label_column in dataset.column_names:
            labels_column = dataset[self.cfg.label_column]
            
            # Convert strings to integers so PyTorch can create numerical label tensors
            if len(labels_column) > 0 and isinstance(labels_column[0], str):
                unique_labels = sorted(list(set(labels_column)))
                l2id = {label: i for i, label in enumerate(unique_labels)}
                labels_column = [l2id[label] for label in labels_column]

            tokenized = tokenized.add_column("labels", labels_column)
            
        return tokenized

    # -------- custom Trainer that records per-sample loss --------
    class _TracingTrainer(Trainer):
        """Subclass that stores per-sample losses every epoch."""

        def __init__(self, loss_store: list, **kwargs):
            super().__init__(**kwargs)
            self.loss_store = loss_store

        def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
            labels = inputs.pop("labels")
            outputs = model(**inputs)
            logits  = outputs.logits

            loss_fn = torch.nn.CrossEntropyLoss(reduction="none")
            per_sample_loss = loss_fn(logits, labels)

            # Store for reverse-engineering later
            self.loss_store.append(per_sample_loss.detach().cpu().tolist())

            loss = per_sample_loss.mean()
            return (loss, outputs) if return_outputs else loss

    # -------- main entry point --------
    def run(self) -> Path:
        tokenized = self._tokenize(self.dataset)
        output_path = Path(self.cfg.output_dir) / "sandbox_model"

        args = TrainingArguments(
            output_dir=str(output_path),
            num_train_epochs=self.cfg.epochs,
            per_device_train_batch_size=self.cfg.batch_size,
            learning_rate=self.cfg.learning_rate,
            logging_steps=10,
            save_strategy="epoch",
            report_to="none",
        )

        trainer = self._TracingTrainer(
            loss_store=self.training_losses_per_sample,
            model=self.model,
            args=args,
            train_dataset=tokenized,
            data_collator=DataCollatorWithPadding(self.tokenizer),
        )

        trainer.train()
        trainer.save_model(str(output_path / "final"))

        return output_path / "final"