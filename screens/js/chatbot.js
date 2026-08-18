(function () {
  if (!window.OFStore) return;

  var MEMBER_TAG = { '하준': 'member-1', '서아': 'member-2', '서연': 'member-3', '민준': 'member-4' };
  var CATEGORY_LABEL = { student: '초중고 학생', family: '가족' };
  var REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '제주', '강원', '충남', '충북', '전남', '전북', '경남', '경북'];
  var LOG_KEY = 'ourfamily_chat_log_v1';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function extractAllTimes(text) {
    var re = /(오전|오후|아침|저녁|밤)?\s*(\d{1,2})\s*(?::|시)\s*(\d{1,2})?\s*분?/g;
    var out = [];
    var m;
    while ((m = re.exec(text))) {
      var ampm = m[1];
      var h = parseInt(m[2], 10);
      var min = m[3] ? parseInt(m[3], 10) : 0;
      var isPm = ampm === '오후' || ampm === '저녁' || ampm === '밤';
      var isAm = ampm === '오전' || ampm === '아침';
      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;
      if (h > 23 || min > 59) continue;
      out.push({ str: pad(h) + ':' + pad(min), index: m.index });
    }
    return out;
  }

  function extractQuoted(text) {
    var m = text.match(/['"“”‘’]([^'"“”‘’]{1,80})['"“”‘’]/);
    return m ? m[1].trim() : null;
  }

  function extractRegion(text) {
    for (var i = 0; i < REGIONS.length; i++) {
      if (text.indexOf(REGIONS[i]) !== -1) return REGIONS[i];
    }
    return null;
  }

  function detectMember(text) {
    var names = Object.keys(MEMBER_TAG);
    for (var i = 0; i < names.length; i++) {
      if (text.indexOf(names[i]) !== -1) return names[i];
    }
    return null;
  }

  function detect(text) {
    var domain = 'todo';
    if (/냉장고/.test(text)) domain = 'fridge';
    else if (/옷차림|지정복|입지|입어야/.test(text)) domain = 'outfit';
    else if (/주말|축제|연극|공연|전시|나들이|볼거리/.test(text)) domain = 'weekend';
    else if (/헤드라인|뉴스|경제|주식|정책|혜택|스포츠|소식/.test(text)) domain = 'info';

    var intent = 'add';
    if (/없다|없어|없음|삭제|지워|빼줘|빼\s*주세요|없애|치워버려|취소해/.test(text)) intent = 'delete';
    else if (/아니고|말고|아니라|수정해|바꿔|변경해/.test(text)) intent = 'edit';
    else if (/뭐.*있|뭐지|뭐야|알려줘|언제|몇\s*시|있나요|있어\?|\?$/.test(text)) intent = 'query';

    return { domain: domain, intent: intent, times: extractAllTimes(text) };
  }

  function buildTodoTitle(text) {
    var t = text;
    t = t.replace(/오늘|내일|모레|이번\s*주|다음\s*주/g, '');
    t = t.replace(/(오전|오후)?\s*\d{1,2}\s*(?::|시)\s*\d{0,2}\s*분?/g, '');
    var gaMatched = false;
    var verbPhrases = [
      '가야\\s*한다', '가야\\s*된다', '가야\\s*돼', '가야\\s*해', '가야지', '가기로\\s*했다', '간다',
      '해야\\s*한다', '해야\\s*된다', '해야\\s*돼', '해야\\s*해', '해야지', '하기로\\s*했다',
      '할\\s*것', '할거야', '할\\s*거야',
      '사야\\s*한다', '사야\\s*된다', '사야지', '사야\\s*해'
    ];
    verbPhrases.forEach(function (vp) {
      var re = new RegExp(vp);
      if (re.test(t)) {
        if (/^가/.test(vp)) gaMatched = true;
        t = t.replace(re, '');
      }
    });
    t = t.replace(/[.,!?？]+\s*$/g, '').trim();
    if (!t) t = '할일';
    var place = t;
    var title = t;
    if (gaMatched && title.indexOf('가기') === -1) title = title + ' 가기';
    return { title: title, place: place };
  }

  function findTodoByTime(str) {
    return OFStore.todos.list().find(function (x) { return x.time === str; }) || null;
  }

  function handleTodo(text, intent, times) {
    var member = detectMember(text);

    if (intent === 'query') {
      var list = OFStore.todos.list(member);
      if (!list.length) return (member || '가족') + ' 할일이 아직 없어요.';
      return (member ? member + '의 ' : '오늘 ') + '할일: ' + list.map(function (t) {
        return t.title + (t.time ? ' (' + t.time + ')' : '') + (t.isDone ? ' [완료]' : '');
      }).join(', ');
    }

    if (intent === 'delete') {
      var q = extractQuoted(text) || buildTodoTitle(text).place;
      var removed = OFStore.todos.removeByTitleFuzzy(q);
      if (removed) return '🗑️ "' + removed.title + '" 할일을 삭제했어요.';
      return '해당하는 할일을 찾지 못했어요.';
    }

    if (intent === 'edit') {
      var todo = null;
      var newTime = null;
      if (times.length >= 2) {
        todo = findTodoByTime(times[0].str) || OFStore.todos.getLastMentioned();
        newTime = times[1].str;
      } else if (times.length === 1) {
        todo = OFStore.todos.getLastMentioned();
        newTime = times[0].str;
      }
      if (!todo || !newTime) return '어떤 할일을 수정할지 찾지 못했어요. 조금 더 구체적으로 말씀해주세요.';
      var oldTime = todo.time;
      OFStore.todos.editTime(todo.id, newTime);
      OFStore.todos.setLastMentioned(todo.id);
      return '✏️ "' + todo.title + '" 시간을 ' + (oldTime || '미정') + ' → ' + newTime + '(으)로 수정했어요.';
    }

    var built = buildTodoTitle(text);
    var time = times[0] ? times[0].str : null;
    var todoNew = OFStore.todos.add(built.title, {
      assignee: member || '가족',
      memberTag: member ? MEMBER_TAG[member] : 'member-1',
      time: time,
      place: built.place
    });
    OFStore.todos.setLastMentioned(todoNew.id);
    return '➕ ' + (time ? ('오늘 ' + time + ' ') : '') + '"' + built.title + '" 할일을 추가했어요.';
  }

  function extractFridgeItem(text) {
    var t = text.replace(/냉장고에\s*/, '').replace(/냉장고\s*/, '');
    t = t.replace(/(?:은|는|이|가|을|를)?\s*(?:없다|없어|없음|삭제해줘|삭제해|삭제|지워줘|지워|빼줘|빼\s*주세요|없애줘|없애|치워버려|치워|취소해|샀어|샀다|넣었어|넣었다|있어|있다|채워놨어|채워줘|채워)\s*$/, '');
    return t.trim();
  }

  function handleFridge(text, intent) {
    var item = extractFridgeItem(text);

    if (intent === 'delete') {
      var removed = OFStore.fridge.removeByName(item);
      if (removed) return '🗑️ 냉장고에서 "' + removed.name + '"을(를) 삭제했어요.';
      return '냉장고에 "' + item + '" 항목이 없어서 지울 게 없어요.';
    }
    if (intent === 'query') {
      var list = OFStore.fridge.list();
      if (!list.length) return '냉장고가 비어있어요.';
      return '냉장고에 있는 재료: ' + list.map(function (f) { return f.name; }).join(', ');
    }
    if (!item) return '냉장고에 추가할 재료 이름을 알려주세요.';
    OFStore.fridge.add(item);
    return '➕ 냉장고에 "' + item + '"을(를) 추가했어요.';
  }

  function stripInfoWords(text) {
    var t = text;
    ['정보', '헤드라인', '뉴스', '경제', '주식', '정책', '혜택', '스포츠', '소식', '추가해줘', '추가해', '추가',
      '등록해줘', '등록해', '등록', '삭제해줘', '삭제해', '삭제', '지워줘', '지워', '에서', '에', '으로', '로'].forEach(function (w) {
      t = t.split(w).join(' ');
    });
    return t.replace(/\s+/g, ' ').trim();
  }

  function findInfoCategory(text) {
    var cats = OFStore.info.listCategories();
    for (var i = 0; i < cats.length; i++) {
      var parts = cats[i].label.split(/[\s·]+/).filter(Boolean);
      for (var j = 0; j < parts.length; j++) {
        if (text.indexOf(parts[j]) !== -1) return cats[i];
      }
    }
    return null;
  }

  function handleInfo(text, intent) {
    var quoted = extractQuoted(text);

    if (intent === 'delete') {
      var target = quoted || stripInfoWords(text);
      var found = null;
      OFStore.info.listCategories().some(function (cat) {
        var item = cat.items.find(function (i) { return i.title.indexOf(target) !== -1 || (target && target.indexOf(i.title) !== -1); });
        if (item) { OFStore.info.removeItem(cat.id, item.id); found = { cat: cat, item: item }; return true; }
        return false;
      });
      if (found) return '🗑️ "' + found.item.title + '"을(를) ' + found.cat.label + '에서 삭제했어요.';
      return '해당하는 소식을 찾지 못했어요. 정확한 제목을 알려주세요.';
    }

    if (intent === 'query') {
      var cat = findInfoCategory(text);
      if (cat) {
        if (!cat.items.length) return cat.label + ' 소식이 아직 없어요.';
        return cat.label + ' 소식: ' + cat.items.map(function (i) { return i.title; }).join(', ');
      }
      var summary = OFStore.info.listCategories().map(function (c) { return c.label + '(' + c.items.length + ')'; }).join(', ');
      return '등록된 정보 카테고리: ' + summary;
    }

    var targetCat = findInfoCategory(text) || OFStore.info.listCategories()[0];
    var title = quoted || stripInfoWords(text);
    if (!title) return '추가할 소식 제목을 알려주세요.';
    OFStore.info.addItem(targetCat.id, title, '');
    return '➕ "' + title + '"을(를) ' + targetCat.label + '에 추가했어요.';
  }

  function stripWeekendWords(text) {
    var t = text;
    ['주말', '나들이', '축제', '연극', '공연', '전시', '볼거리', '초중고 학생', '학생', '가족',
      '추가해줘', '추가해', '추가', '등록해줘', '등록해', '등록', '삭제해줘', '삭제해', '삭제', '지워줘', '지워',
      '에서', '에', '으로', '로'].forEach(function (w) {
      t = t.split(w).join(' ');
    });
    return t.replace(/\s+/g, ' ').trim();
  }

  function handleWeekend(text, intent) {
    var quoted = extractQuoted(text);
    var category = null;
    if (/초중고\s*학생|학생/.test(text)) category = 'student';
    else if (/가족/.test(text)) category = 'family';

    if (intent === 'delete') {
      var target = quoted || stripWeekendWords(text);
      var removed = OFStore.weekend.removeByTitleFuzzy(target);
      if (removed) return '🗑️ "' + removed.title + '"을(를) 주말 나들이 목록에서 삭제했어요.';
      return '해당하는 나들이 항목을 찾지 못했어요.';
    }
    if (intent === 'query') {
      var list = OFStore.weekend.list(category || 'all');
      if (!list.length) return '조건에 맞는 주말 나들이 정보가 아직 없어요.';
      return (category ? CATEGORY_LABEL[category] + ' ' : '') + '주말 추천: ' + list.map(function (a) { return a.title + '(' + a.region + ')'; }).join(', ');
    }

    var title = quoted || stripWeekendWords(text);
    if (!title) return '추가할 나들이 이름을 알려주세요.';
    OFStore.weekend.add({ title: title, category: category || 'family', region: extractRegion(text) || '서울' });
    return '➕ "' + title + '"을(를) 주말 나들이 목록에 추가했어요.';
  }

  var DAY_MAP = { '월요일': 'mon', '화요일': 'tue', '수요일': 'wed', '목요일': 'thu', '금요일': 'fri', '토요일': 'sat', '일요일': 'sun' };
  var DAY_LABEL = { mon: '월요일', tue: '화요일', wed: '수요일', thu: '목요일', fri: '금요일', sat: '토요일', sun: '일요일' };

  function findDayInText(text) {
    var keys = Object.keys(DAY_MAP);
    for (var i = 0; i < keys.length; i++) {
      if (text.indexOf(keys[i]) !== -1) return DAY_MAP[keys[i]];
    }
    return null;
  }

  function stripOutfitWords(text) {
    var t = text;
    ['옷차림', '지정복', '입지', '입어야', '수정해줘', '수정해', '수정', '바꿔줘', '바꿔', '변경해줘', '변경해', '아니고', '말고', '이다', '이야', '으로', '로'].forEach(function (w) {
      t = t.split(w).join(' ');
    });
    Object.keys(DAY_MAP).forEach(function (d) { t = t.split(d).join(' '); });
    return t.replace(/\s+/g, ' ').trim();
  }

  function handleOutfit(text, intent) {
    if (!window.OFStore.outfit) return '이 화면에서는 옷차림 정보를 다루지 않아요.';
    var day = findDayInText(text) || OFStore.outfit.todayKey();
    var dayLabel = findDayInText(text) ? DAY_LABEL[day] : '오늘';

    if (intent === 'edit') {
      var quoted = extractQuoted(text);
      var newType = quoted || stripOutfitWords(text);
      if (!newType) return '어떤 옷차림으로 바꿀지 알려주세요.';
      OFStore.outfit.setRule('하준', day, newType);
      return '✏️ ' + dayLabel + ' 지정복을 "' + newType + '"(으)로 수정했어요.';
    }

    var rule = OFStore.outfit.getRule('하준', day);
    if (!rule) return dayLabel + ' 옷차림 정보가 아직 없어요.';
    return dayLabel + ' 지정복은 "' + rule.outfitType + '"이에요.';
  }

  function respond(text) {
    var parsed = detect(text);
    if (parsed.domain === 'fridge') return handleFridge(text, parsed.intent);
    if (parsed.domain === 'outfit') return handleOutfit(text, parsed.intent);
    if (parsed.domain === 'info') return handleInfo(text, parsed.intent);
    if (parsed.domain === 'weekend') return handleWeekend(text, parsed.intent);
    return handleTodo(text, parsed.intent, parsed.times);
  }

  function loadLog() {
    try {
      var raw = sessionStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveLog(log) {
    try { sessionStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-40))); } catch (e) {}
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '#of-chat-panel.open { display: block; }' +
      '@keyframes of-panel-in { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' +
      '#of-chat-panel.open > div { animation: of-panel-in 0.22s cubic-bezier(0.16,1,0.3,1) both; }' +
      '@media (prefers-reduced-motion: reduce) { #of-chat-panel.open > div { animation: none; } }' +
      '.of-bubble-bot { background: #F1ECE4; color: #2B2A28; align-self: flex-start; }' +
      '.of-bubble-user { background: #0055FF; color: #FFFFFF; align-self: flex-end; }';
    document.head.appendChild(style);
  }

  function buildWidget() {
    var root = document.createElement('div');
    root.innerHTML =
      '<button id="of-chat-fab" aria-label="가족 챗봇 열기" class="fixed z-40 bottom-20 right-6 w-14 h-14 rounded-full bg-primary text-on-primary shadow-soft flex items-center justify-center active:scale-90 transition duration-150" style="box-shadow:0 4px 14px rgba(0,85,255,0.35), 0 2px 8px rgba(43,42,40,0.12);">' +
        '<i class="ph-fill ph-chat-circle-dots text-2xl"></i>' +
      '</button>' +
      '<div id="of-chat-panel" class="fixed inset-x-0 bottom-0 z-50">' +
        '<div class="max-w-md mx-auto bg-surface border border-border rounded-t-lg shadow-soft flex flex-col" style="height:min(70vh, 560px);">' +
          '<div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">' +
            '<div class="flex items-center gap-2">' +
              '<span class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><i class="ph-duotone ph-robot text-lg text-primary"></i></span>' +
              '<span class="font-display font-bold text-[15px]">우리가족 챗봇</span>' +
            '</div>' +
            '<button id="of-chat-close" aria-label="챗봇 닫기" class="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition duration-150">' +
              '<i class="ph-bold ph-x text-lg text-foreground-muted"></i>' +
            '</button>' +
          '</div>' +
          '<div id="of-chat-log" class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"></div>' +
          '<form id="of-chat-form" class="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">' +
            '<input id="of-chat-input" type="text" placeholder="예: 오늘 18시 도서관 가야 된다" class="flex-1 bg-surface-muted rounded-md px-3 py-2.5 text-[15px] border border-border" autocomplete="off">' +
            '<button type="submit" class="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 active:scale-90 transition duration-150" aria-label="보내기">' +
              '<i class="ph-bold ph-paper-plane-right text-lg"></i>' +
            '</button>' +
          '</form>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    var fab = document.getElementById('of-chat-fab');
    var panel = document.getElementById('of-chat-panel');
    var closeBtn = document.getElementById('of-chat-close');
    var form = document.getElementById('of-chat-form');
    var input = document.getElementById('of-chat-input');
    var log = document.getElementById('of-chat-log');

    panel.style.display = 'none';

    function appendBubble(role, text) {
      var bubble = document.createElement('div');
      bubble.className = (role === 'user' ? 'of-bubble-user' : 'of-bubble-bot') + ' max-w-[85%] rounded-lg px-3.5 py-2.5 text-[15px] leading-[22px] font-body';
      bubble.textContent = text;
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;
    }

    var history = loadLog();
    if (!history.length) {
      history.push({ role: 'bot', text: '안녕하세요! 오늘 할일, 냉장고 재료, 정보 소식, 주말 나들이를 물어보거나 자연어로 추가·수정·삭제할 수 있어요.' });
      saveLog(history);
    }
    history.forEach(function (m) { appendBubble(m.role, m.text); });

    function openPanel() {
      panel.style.display = 'block';
      panel.classList.add('open');
      fab.style.display = 'none';
      setTimeout(function () { input.focus(); }, 50);
    }
    function closePanel() {
      panel.classList.remove('open');
      panel.style.display = 'none';
      fab.style.display = 'flex';
    }

    fab.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      appendBubble('user', text);
      history.push({ role: 'user', text: text });

      var reply;
      try {
        reply = respond(text);
      } catch (err) {
        reply = '죄송해요, 이 문장은 이해하지 못했어요. 다른 방식으로 말씀해주시겠어요?';
      }
      appendBubble('bot', reply);
      history.push({ role: 'bot', text: reply });
      saveLog(history);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { injectStyles(); buildWidget(); });
  } else {
    injectStyles();
    buildWidget();
  }
})();
