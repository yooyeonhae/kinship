(function () {
  var MOCK_TODAY = {
    tempC: 18,
    condition: 'rain-light',
    icon: 'ph-cloud-sun',
    description: '오전에 비 조금 · 저녁까지 흐림'
  };

  var DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

  function todayLabel() {
    var d = new Date();
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + DAY_NAMES[d.getDay()] + '요일';
  }

  function fetchMock() {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({
          dateLabel: todayLabel(),
          tempC: MOCK_TODAY.tempC,
          condition: MOCK_TODAY.condition,
          icon: MOCK_TODAY.icon,
          description: MOCK_TODAY.description
        });
      }, 250);
    });
  }

  function fetchReal() {
    return Promise.reject(new Error('기상청 공공데이터포털 API는 브라우저 직접 호출이 막혀 있어(CORS·키 노출) 서버 프록시 준비 후 연동 예정입니다.'));
  }

  function buildRecommendation(outfitType, weather) {
    var extra = null;
    if (/rain/.test(weather.condition)) {
      extra = { name: '우비', note: '비가 올 수 있어서 우산보다 우비가 편해요.' };
    } else if (weather.tempC <= 10) {
      extra = { name: '겉옷', note: '쌀쌀하니 겉옷 하나만 챙기면 충분해요.' };
    } else if (weather.tempC >= 28) {
      extra = { name: '얇은 여벌옷', note: '땀이 많이 날 수 있어서 얇은 여벌옷을 챙겨주세요.' };
    }
    return {
      main: outfitType,
      extra: extra,
      title: extra ? (outfitType + ' + ' + extra.name) : outfitType,
      note: extra ? extra.note : '오늘은 별다른 준비물 없이 지정복만 챙기면 충분해요.'
    };
  }

  window.OFWeather = {
    getToday: function () {
      var key = window.OF_CONFIG && window.OF_CONFIG.weatherApiKey;
      return key ? fetchReal(key) : fetchMock();
    },
    buildRecommendation: buildRecommendation
  };
})();
