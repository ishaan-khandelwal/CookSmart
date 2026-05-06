const navbar = document.querySelector('.navbar');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const navItems = document.querySelectorAll('.nav-links a');
const downloadStatus = document.querySelector('#download-status');
const appLinks = document.querySelectorAll('[data-app-link]');

const closeMenu = () => {
    navLinks?.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
};

window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 50);
});

menuToggle?.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
        const hash = anchor.getAttribute('href');

        if (!hash || hash === '#') {
            return;
        }

        const target = document.getElementById(hash.slice(1));

        if (!target) {
            return;
        }

        event.preventDefault();
        closeMenu();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

navItems.forEach(link => {
    link.addEventListener('click', () => {
        if (!link.getAttribute('href')?.startsWith('#')) {
            closeMenu();
        }
    });
});

appLinks.forEach(link => {
    link.addEventListener('click', event => {
        if (window.location.protocol !== 'file:') {
            return;
        }

        event.preventDefault();
        window.location.href = 'http://localhost:3000/app';
    });
});

document.querySelectorAll('[data-download-platform]').forEach(button => {
    button.addEventListener('click', () => {
        const platform = button.getAttribute('data-download-platform');

        if (downloadStatus) {
            downloadStatus.textContent = `${platform} download link is not configured yet. Add the store URL and this button will open it directly.`;
        }
    });
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .step, .section-header, .about-layout').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
});

if (window.lucide) {
    window.lucide.createIcons();
}
