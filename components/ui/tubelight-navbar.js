// Tubelight Navbar (vanilla JS + Tailwind)
// Renders into a container via renderTubelightNavBar(rootId, items)

function renderTubelightNavBar(rootId, items) {
  const root = document.getElementById(rootId);
  if (!root || !Array.isArray(items) || items.length === 0) return;

  const container = document.createElement('div');
  container.className =
    'fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-6 sm:pt-6';

  const bar = document.createElement('div');
  bar.className =
    'flex items-center gap-3 bg-white/10 border border-gray-200 backdrop-blur-lg py-1 px-1 rounded-full shadow-lg';

  container.appendChild(bar);

  let activeName = items[0].name;

  items.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.url || '#';
    link.dataset.name = item.name;
    link.className =
      'relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors text-gray-700 hover:text-blue-600';

    // Desktop text label and mobile icon
    const desktopSpan = document.createElement('span');
    desktopSpan.className = 'hidden md:inline';
    desktopSpan.textContent = item.name;

    const mobileSpan = document.createElement('span');
    mobileSpan.className = 'md:hidden flex items-center justify-center';

    // Use Lucide via CDN
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', (item.icon || '').toLowerCase());
    iconEl.setAttribute('data-size', '18');
    iconEl.setAttribute('data-stroke-width', '2.5');

    mobileSpan.appendChild(iconEl);

    link.appendChild(desktopSpan);
    link.appendChild(mobileSpan);

    function addLamp(target) {
      if (target.querySelector('.lamp')) return;
      const lamp = document.createElement('div');
      lamp.className =
        'lamp absolute inset-0 w-full bg-blue-600/10 rounded-full -z-10 transition-all';

      const tube = document.createElement('div');
      tube.className =
        'absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-t-full';

      const glow1 = document.createElement('div');
      glow1.className =
        'absolute w-12 h-6 bg-blue-600/20 rounded-full blur-md -top-2 -left-2';
      const glow2 = document.createElement('div');
      glow2.className =
        'absolute w-8 h-6 bg-blue-600/20 rounded-full blur-md -top-1';
      const glow3 = document.createElement('div');
      glow3.className =
        'absolute w-4 h-4 bg-blue-600/20 rounded-full blur-sm top-0 left-2';

      tube.appendChild(glow1);
      tube.appendChild(glow2);
      tube.appendChild(glow3);

      lamp.appendChild(tube);
      target.appendChild(lamp);
    }

    function removeLamp(target) {
      const lamp = target.querySelector('.lamp');
      if (lamp) lamp.remove();
    }

    function setActive(isActive) {
      if (isActive) {
        link.classList.add('bg-gray-100', 'text-blue-600');
        addLamp(link);
      } else {
        link.classList.remove('bg-gray-100', 'text-blue-600');
        removeLamp(link);
      }
    }

    setActive(item.name === activeName);

    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#')) {
        e.preventDefault();
        const id = href.slice(1);
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      } else if (href === '#') {
        e.preventDefault();
      }

      activeName = item.name;

      const links = bar.querySelectorAll('a');
      links.forEach((a) => {
        const isActive = a.dataset.name === activeName;
        if (isActive) {
          a.classList.add('bg-gray-100', 'text-blue-600');
          addLamp(a);
        } else {
          a.classList.remove('bg-gray-100', 'text-blue-600');
          removeLamp(a);
        }
      });

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    });

    bar.appendChild(link);
  });

  root.innerHTML = '';
  root.appendChild(container);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  const sectionIds = items
    .map(i => (i.url || '').startsWith('#') ? (i.url || '').slice(1) : null)
    .filter(Boolean);

  if (sectionIds.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const nameForSection = items.find(i => (i.url || '').slice(1) === entry.target.id)?.name;
          if (nameForSection && nameForSection !== activeName) {
            activeName = nameForSection;
            const links = bar.querySelectorAll('a');
            links.forEach((a) => {
              const isActive = a.dataset.name === activeName;
              if (isActive) {
                a.classList.add('bg-gray-100', 'text-blue-600');
                addLamp(a);
              } else {
                a.classList.remove('bg-gray-100', 'text-blue-600');
                removeLamp(a);
              }
            });
          }
        }
      });
    }, { threshold: 0.6 });

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
}

// If needed elsewhere:
// window.renderTubelightNavBar = renderTubelightNavBar;