# POISON AI
Poison AI is an application that brings to life the question: It's possible to use AI tech to safeguard AI training data?  
## The problem
Currently, the word is moving towards a direction filled with AI, where AI assistants are inside companies not just helping customers but helping workers, and how come we are able to trust them if we aren't sure they learn correctly?  
There's a lot of ways to contaminate, damage or use an AI model with the training data, as it's the base upon which the model thinking process is constructed, and the attack methods will always be ahead of the preventive measures.  
Backdoors, poisoned data, data leakage, trojan attacks and supply chain attacks are some examples of risks and attacks made to an AI model with the training data (or that abuse it after deployment), and some are impossible to identify inside the training data, and only became visible after the model is trained, point at which is already too late as the damage has already occurred.   
## Solution
Poison AI removes that worry, instead of trying new methods and whatnot to try and identify the invisible threads inside training data, we take the poison ourselves on free AI models, fine tunning them inside a safe environment with the training data you provide, and analyzing the model in search for any sign of contamination or unexpected behavior.  
This may not showcase all problems, as that would need way too much time, but it's at least capable of finding those threads that makes the model unrepairable and dangerous, keeping your company secure and saving not only time, but your reputation.  

## How does it work?
Poison AI uses small models (250 million parameters) from hugging face, using python, torch, peft and transformers, we fine tune a matching model (Language model, Generative model) for the training data you provide, and with libraries like numpy and sklearn, we analyze the model weights, data loss, label disparity among others, and by keeping track along all this process, we identify those elements inside the dataset that are most likely to be the cause for any unexpected/dangerous behavior.   
Since the models are executed on a controlled environment with no connection to the main server and with no permissions, no matter what the AI model tries to make it's anormal behavior invisible, it'll be detected and reported.  
### Allowed data
The accepted file extensions are:
- .json
- .jsonl
- .txt
- .md
- .parquet
- .csv
- .arrow
- .xlsx