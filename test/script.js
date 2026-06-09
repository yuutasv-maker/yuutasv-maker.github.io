document.addEventListener('DOMContentLoaded', () => {
    // Reveal animations on scroll
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.1
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // Sticky CTA Visibility
    const hero = document.getElementById('hero');
    const cta = document.getElementById('sticky-cta');
    
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // If hero is NOT intersecting (scrolled past), show CTA
            if (!entry.isIntersecting) {
                cta.classList.add('visible');
            } else {
                cta.classList.add('visible'); // Actually, user might want it visible always or after scroll
                // Requirement says: "スクロールしても画面下部に固定（追従）させるか、アクセントカラーで目立たせる"
                // Let's make it appear after hero to keep it clean.
                cta.classList.remove('visible');
            }
        });
    }, {
        threshold: 0.1
    });

    heroObserver.observe(hero);

    // Initial check for CTA in case of refresh mid-page
    if (window.scrollY > 100) {
        cta.classList.add('visible');
    }

    // Smooth scroll for internal links (if any)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});
