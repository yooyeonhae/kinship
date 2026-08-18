(function () {
  var MOCK_POOL = [
    { title: '서울 밤도깨비 야시장', region: '서울', location: 'DDP', dateLabel: '이번 주말', keywords: ['야경', '로맨틱'] },
    { title: '수원 화성문화제', region: '경기', location: '수원화성', dateLabel: '10.3 ~ 10.5', keywords: ['가족', '전통'] },
    { title: '부산 불꽃축제', region: '부산', location: '광안리해수욕장', dateLabel: '11.1', keywords: ['커플', '야경'] },
    { title: '청소년 진로직업체험 박람회', region: '서울', location: '코엑스', dateLabel: '이번 주말', keywords: ['학생', '진로'] },
    { title: '전주 한옥마을 등불축제', region: '전북', location: '전주 한옥마을', dateLabel: '매주 토요일', keywords: ['가족', '전통'] },
    { title: '대관령 눈꽃축제', region: '강원', location: '대관령', dateLabel: '1.10 ~ 1.20', keywords: ['가족', '겨울'] }
  ];

  function classifyCategory(item) {
    if (item.keywords.indexOf('학생') !== -1 || item.keywords.indexOf('진로') !== -1) return 'student';
    return 'family';
  }

  function toActivity(item) {
    return {
      title: item.title,
      category: classifyCategory(item),
      type: 'festival',
      region: item.region,
      date: item.dateLabel,
      location: item.location,
      source: 'tourapi'
    };
  }

  function fetchMock(region) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var pool = region && region !== 'all' ? MOCK_POOL.filter(function (i) { return i.region === region; }) : MOCK_POOL;
        resolve(pool.map(toActivity));
      }, 250);
    });
  }

  function fetchReal() {
    return Promise.reject(new Error('한국관광공사 TourAPI는 서비스키 노출·CORS 문제로 서버 프록시 준비 후 연동 예정입니다.'));
  }

  window.OFTourAPI = {
    fetchFestivals: function (region) {
      var key = window.OF_CONFIG && window.OF_CONFIG.tourApiKey;
      return key ? fetchReal(key, region) : fetchMock(region);
    }
  };
})();
