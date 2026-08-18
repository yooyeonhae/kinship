(function () {
  var KEY = 'ourfamily_store_v1';

  var DEFAULTS = {
    todos: [
      { id: 't1', title: '하준 태권도 준비물 챙기기', assignee: '서연', memberTag: 'member-3', isDone: false, time: null, place: null },
      { id: 't2', title: '서아 어린이집 알림장 확인', assignee: '서연', memberTag: 'member-3', isDone: true, time: null, place: null },
      { id: 't3', title: '장보기 — 우유, 계란', assignee: '민준', memberTag: 'member-4', isDone: false, time: null, place: null },
      { id: 't4', title: '관리비 이체하기', assignee: '민준', memberTag: 'member-4', isDone: true, time: null, place: null },
      { id: 't5', title: '가방 챙기기', assignee: '하준', memberTag: 'member-1', isDone: true, time: null, place: null },
      { id: 't6', title: '물통 채우기', assignee: '하준', memberTag: 'member-1', isDone: true, time: null, place: null },
      { id: 't7', title: '숙제 가방에 넣기', assignee: '하준', memberTag: 'member-1', isDone: false, time: null, place: null },
      { id: 't8', title: '우비 입기', assignee: '하준', memberTag: 'member-1', isDone: false, time: null, place: null }
    ],
    fridge: [
      { id: 'f1', name: '우유' },
      { id: 'f2', name: '계란' },
      { id: 'f3', name: '소세지' },
      { id: 'f4', name: '두부' },
      { id: 'f5', name: '애호박' }
    ],
    infoCategories: [
      {
        id: 'c1', key: 'economy', label: '경제 헤드라인', icon: 'ph-chart-line-up',
        items: [
          { id: 'i1', title: '기준금리 동결, 시장 반응은?', source: '경제신문' },
          { id: 'i2', title: '3분기 물가 상승률 둔화', source: '연합속보' }
        ]
      },
      {
        id: 'c2', key: 'stock', label: '주식', icon: 'ph-trend-up',
        items: [
          { id: 'i3', title: '코스피 2,650선 마감', source: '증권시황' },
          { id: 'i4', title: '반도체株 강세 지속', source: '증권시황' }
        ]
      },
      {
        id: 'c3', key: 'policy', label: '국가 혜택 · 정책', icon: 'ph-bank',
        items: [
          { id: 'i5', title: '아동수당 신청 기간 안내', source: '정부24' },
          { id: 'i6', title: '에너지바우처 신청 시작', source: '복지로' }
        ]
      },
      {
        id: 'c4', key: 'sports', label: '스포츠', icon: 'ph-basketball',
        items: [
          { id: 'i7', title: '프로야구 오늘 경기 일정', source: '스포츠뉴스' }
        ]
      }
    ],
    weekend: [
      { id: 'w1', title: '한강 불꽃 야시장', category: 'family', type: 'festival', region: '서울', date: '이번 주말', location: '여의도 한강공원', source: 'manual' },
      { id: 'w2', title: '연극 <봄날의 곰을 좋아하세요?>', category: 'family', type: 'play', region: '서울', date: '상시', location: '대학로', source: 'manual' },
      { id: 'w3', title: '어린이 과학관 체험전', category: 'family', type: 'sight', region: '경기', date: '이번 주말', location: '수원', source: 'manual' },
      { id: 'w4', title: '청소년 진로박람회', category: 'student', type: 'sight', region: '서울', date: '토요일', location: 'coex', source: 'manual' }
    ],
    outfitRules: [
      { id: 'o1', member: '하준', day: 'mon', outfitType: '평상복' },
      { id: 'o2', member: '하준', day: 'tue', outfitType: '평상복' },
      { id: 'o3', member: '하준', day: 'wed', outfitType: '체육복' },
      { id: 'o4', member: '하준', day: 'thu', outfitType: '평상복' },
      { id: 'o5', member: '하준', day: 'fri', outfitType: '미술 가운' },
      { id: 'o6', member: '하준', day: 'sat', outfitType: '평상복' },
      { id: 'o7', member: '하준', day: 'sun', outfitType: '평상복' }
    ],
    chat: [
      { id: 'm1', sender: '서연', memberTag: 'member-3', content: '얘들아 엄마 오늘 좀 늦을 것 같아, 저녁 챙겨 먹고 있어!', ts: 1 },
      { id: 'm2', sender: '하준', memberTag: 'member-1', content: '넵! 숙제 다 하고 게임하고 있을게요', ts: 2 }
    ]
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  var VALID_WEEKEND_CATEGORIES = ['student', 'family'];

  function normalizeWeekend(list) {
    list.forEach(function (a) {
      if (VALID_WEEKEND_CATEGORIES.indexOf(a.category) === -1) a.category = 'family';
    });
    return list;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      var parsed = JSON.parse(raw);
      return {
        todos: parsed.todos || clone(DEFAULTS.todos),
        fridge: parsed.fridge || clone(DEFAULTS.fridge),
        infoCategories: parsed.infoCategories || clone(DEFAULTS.infoCategories),
        weekend: normalizeWeekend(parsed.weekend || clone(DEFAULTS.weekend)),
        outfitRules: parsed.outfitRules || clone(DEFAULTS.outfitRules),
        chat: parsed.chat || clone(DEFAULTS.chat)
      };
    } catch (e) {
      return clone(DEFAULTS);
    }
  }

  var state = load();
  var lastTodoId = null;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('of:change'));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function normalize(s) {
    return (s || '').trim().toLowerCase();
  }

  var Store = {
    onChange: function (cb) { window.addEventListener('of:change', cb); },

    todos: {
      list: function (assignee) {
        var all = state.todos;
        return assignee ? all.filter(function (t) { return t.assignee === assignee; }) : all.slice();
      },
      add: function (title, opts) {
        opts = opts || {};
        var todo = {
          id: uid('t'),
          title: title,
          assignee: opts.assignee || '가족',
          memberTag: opts.memberTag || 'member-1',
          isDone: false,
          time: opts.time || null,
          place: opts.place || null
        };
        state.todos.push(todo);
        lastTodoId = todo.id;
        persist();
        return todo;
      },
      toggle: function (id) {
        var t = state.todos.find(function (x) { return x.id === id; });
        if (!t) return null;
        t.isDone = !t.isDone;
        persist();
        return t;
      },
      remove: function (id) {
        var idx = state.todos.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return false;
        state.todos.splice(idx, 1);
        persist();
        return true;
      },
      removeByTitleFuzzy: function (query) {
        var q = normalize(query);
        var idx = state.todos.findIndex(function (x) { return normalize(x.title).indexOf(q) !== -1; });
        if (idx === -1) return null;
        var removed = state.todos[idx];
        state.todos.splice(idx, 1);
        persist();
        return removed;
      },
      findByTitleFuzzy: function (query) {
        var q = normalize(query);
        return state.todos.find(function (x) { return normalize(x.title).indexOf(q) !== -1; }) || null;
      },
      editTime: function (id, time) {
        var t = state.todos.find(function (x) { return x.id === id; });
        if (!t) return null;
        t.time = time;
        persist();
        return t;
      },
      getLastMentioned: function () {
        return state.todos.find(function (x) { return x.id === lastTodoId; }) || null;
      },
      setLastMentioned: function (id) { lastTodoId = id; }
    },

    fridge: {
      list: function () { return state.fridge.slice(); },
      add: function (name) {
        var exists = state.fridge.find(function (x) { return normalize(x.name) === normalize(name); });
        if (exists) return exists;
        var item = { id: uid('f'), name: name };
        state.fridge.push(item);
        persist();
        return item;
      },
      removeByName: function (name) {
        var q = normalize(name);
        var idx = state.fridge.findIndex(function (x) { return normalize(x.name).indexOf(q) !== -1 || q.indexOf(normalize(x.name)) !== -1; });
        if (idx === -1) return null;
        var removed = state.fridge[idx];
        state.fridge.splice(idx, 1);
        persist();
        return removed;
      },
      has: function (name) {
        var q = normalize(name);
        return !!state.fridge.find(function (x) { return normalize(x.name).indexOf(q) !== -1; });
      }
    },

    info: {
      listCategories: function () { return state.infoCategories.slice(); },
      addCategory: function (label, icon) {
        var cat = { id: uid('c'), key: normalize(label).replace(/\s+/g, '-'), label: label, icon: icon || 'ph-newspaper', items: [] };
        state.infoCategories.push(cat);
        persist();
        return cat;
      },
      removeCategory: function (id) {
        var idx = state.infoCategories.findIndex(function (c) { return c.id === id; });
        if (idx === -1) return false;
        state.infoCategories.splice(idx, 1);
        persist();
        return true;
      },
      addItem: function (categoryId, title, source) {
        var cat = state.infoCategories.find(function (c) { return c.id === categoryId; });
        if (!cat) return null;
        var item = { id: uid('i'), title: title, source: source || '' };
        cat.items.push(item);
        persist();
        return item;
      },
      removeItem: function (categoryId, itemId) {
        var cat = state.infoCategories.find(function (c) { return c.id === categoryId; });
        if (!cat) return false;
        var idx = cat.items.findIndex(function (i) { return i.id === itemId; });
        if (idx === -1) return false;
        cat.items.splice(idx, 1);
        persist();
        return true;
      },
      findCategoryByLabelFuzzy: function (query) {
        var q = normalize(query);
        return state.infoCategories.find(function (c) { return normalize(c.label).indexOf(q) !== -1 || q.indexOf(normalize(c.label)) !== -1; }) || null;
      }
    },

    weekend: {
      list: function (category) {
        var all = state.weekend;
        return category && category !== 'all' ? all.filter(function (a) { return a.category === category; }) : all.slice();
      },
      add: function (data) {
        var activity = {
          id: uid('w'),
          title: data.title,
          category: data.category || 'family',
          type: data.type || 'sight',
          region: data.region || '서울',
          date: data.date || '이번 주말',
          location: data.location || '',
          source: data.source || 'manual'
        };
        state.weekend.push(activity);
        persist();
        return activity;
      },
      hasTitle: function (title) {
        var q = normalize(title);
        return !!state.weekend.find(function (a) { return normalize(a.title) === q; });
      },
      remove: function (id) {
        var idx = state.weekend.findIndex(function (a) { return a.id === id; });
        if (idx === -1) return false;
        state.weekend.splice(idx, 1);
        persist();
        return true;
      },
      removeByTitleFuzzy: function (query) {
        var q = normalize(query);
        var idx = state.weekend.findIndex(function (a) { return normalize(a.title).indexOf(q) !== -1; });
        if (idx === -1) return null;
        var removed = state.weekend[idx];
        state.weekend.splice(idx, 1);
        persist();
        return removed;
      }
    },

    outfit: {
      todayKey: function () {
        var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        return days[new Date().getDay()];
      },
      getRule: function (member, day) {
        return state.outfitRules.find(function (r) { return r.member === member && r.day === day; }) || null;
      },
      setRule: function (member, day, outfitType) {
        var rule = state.outfitRules.find(function (r) { return r.member === member && r.day === day; });
        if (!rule) {
          rule = { id: uid('o'), member: member, day: day, outfitType: outfitType };
          state.outfitRules.push(rule);
        } else {
          rule.outfitType = outfitType;
        }
        persist();
        return rule;
      }
    },

    chat: {
      list: function () { return state.chat.slice(); },
      add: function (sender, memberTag, content) {
        var msg = { id: uid('m'), sender: sender, memberTag: memberTag, content: content, ts: Date.now() };
        state.chat.push(msg);
        persist();
        return msg;
      }
    }
  };

  window.OFStore = Store;
})();
