(function () {
  var CHILD_PAGES = ['child-outfit.html', 'child-todo.html'];

  function currentPage() {
    var path = location.pathname.split('/').pop();
    return path || 'entry.html';
  }

  function isChildContext() {
    return CHILD_PAGES.indexOf(currentPage()) !== -1;
  }

  function buildTabs() {
    return [
      { label: '홈', emoji: '🏠', href: 'entry.html' },
      { label: '할일', emoji: '✅', href: isChildContext() ? 'child-todo.html' : 'parent-tasks.html' },
      { label: '정보', emoji: '📰', href: 'info-feed.html' },
      { label: '주말', emoji: '🎈', href: 'weekend.html' },
      { label: '아지트', emoji: '⛺', href: 'family-room.html' }
    ];
  }

  function build() {
    var cur = currentPage();
    var tabs = buildTabs();
    var nav = document.createElement('nav');
    nav.setAttribute('aria-label', '주요 화면 이동');
    nav.className = 'fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-border';
    nav.style.paddingBottom = 'env(safe-area-inset-bottom)';
    nav.innerHTML = '<div class="max-w-md mx-auto grid grid-cols-5">' +
      tabs.map(function (tab) {
        var active = tab.href === cur;
        return '' +
          '<a href="' + tab.href + '" class="flex flex-col items-center gap-1 py-2.5 active:scale-95 transition duration-150" aria-current="' + (active ? 'page' : 'false') + '">' +
            '<span class="text-xl ' + (active ? '' : 'opacity-60 grayscale') + '" aria-hidden="true">' + tab.emoji + '</span>' +
            '<span class="text-[11px] font-display font-bold ' + (active ? 'text-primary' : 'text-foreground-muted') + '">' + tab.label + '</span>' +
          '</a>';
      }).join('') +
      '</div>';
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
