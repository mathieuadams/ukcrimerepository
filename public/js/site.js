document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mobile-menu-btn');
  const nav = document.querySelector('.nav-links');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    nav.classList.toggle('open');     // show/hide menu
    btn.classList.toggle('active');   // animate lines
  });

  // Close menu when clicking outside (nice to have)
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !btn.contains(e.target)) {
      nav.classList.remove('open');
      btn.classList.remove('active');
    }
  });

  // Reset on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      nav.classList.remove('open');
      btn.classList.remove('active');
    }
  });
});
