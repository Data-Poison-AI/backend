
            document.addEventListener('DOMContentLoaded', function() {
            const sections = document.querySelectorAll('section');
            const navLinks = document.querySelectorAll('.sidebar-link');

            function highlightNavOnScroll() {
                let scrollY = window.scrollY;
                sections.forEach(current => {
                    const sectionHeight = current.offsetHeight;
                    const sectionTop    = current.offsetTop - 100;
                    const sectionId     = current.getAttribute('id');
                    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                        navLinks.forEach(link => link.classList.remove('active'));
                        let activeLink = document.querySelector(`.sidebar-link[href*="${sectionId}"]`);
                        if (activeLink) activeLink.classList.add('active');
                    }
                });
            }

            window.addEventListener('scroll', highlightNavOnScroll);

            navLinks.forEach(link => {
                link.addEventListener('click', function() {
                    navLinks.forEach(nav => nav.classList.remove('active'));
                    this.classList.add('active');
                });
            });
        });
 