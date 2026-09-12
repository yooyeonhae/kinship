/**
 * 아이들 맞춤 '오늘의 정보' 컨텐츠 데이터셋
 * 1) 역사 속 오늘 (Today in History)
 * 2) 과학·우주 한 줄 (Kid-friendly Trivia & 왜 그럴까요?)
 * 3) 순우리말 & 실생활 영단어 (Word of the Day & 예문)
 * 4) 넌센스 퀴즈 & 하브루타 생각 질문 (Quiz & Thinking Prompts)
 */

// 1. 오늘의 역사 속 오늘 (Today in History)
export const HISTORY_EVENTS = [
  {
    id: 'h1',
    period: '100여 년 전 오늘',
    dateLabel: '12월 17일',
    title: '라이트 형제가 최초로 하늘을 날았어요 ✈️',
    summary: '미국의 라이트 형제가 직접 만든 동력 비행기 "플라이어호"를 타고 12초 동안 36m를 날아오르는 데 성공했어요. 인류가 하늘을 날게 된 기적의 시작이었답니다!',
    funFact: '첫 비행 거리는 오늘날 대형 여객기의 날개 길이보다 짧았대요.',
  },
  {
    id: 'h2',
    period: '580여 년 전 오늘',
    dateLabel: '10월 9일',
    title: '세종대왕이 한글(훈민정음)을 반포했어요 📜',
    summary: '세종대왕은 백성들이 어려운 한자 때문에 글을 읽지 못하는 것을 안타깝게 여겨, 누구나 하루 만에 쉽게 배울 수 있는 과학적인 글자 "한글"을 만들어 널리 알렸어요.',
    funFact: '한글의 자음은 혀, 입술, 이, 목구멍의 모양을 본떠 만들어졌어요.',
  },
  {
    id: 'h3',
    period: '30여 년 전 오늘',
    dateLabel: '8월 11일',
    title: '우리나라 최초의 인공위성 "우리별 1호" 발사 🛰️',
    summary: '남미의 발사장에서 우리나라 최초의 인공위성 우리별 1호가 우주로 힘차게 날아올랐어요. 한국도 당당한 우주 강국으로 첫발을 내디딘 감격스러운 날이었답니다.',
    funFact: '우리별 1호는 무게가 약 50kg으로 학생 한 명 몸무게 정도였어요.',
  },
  {
    id: 'h4',
    period: '430여 년 전 오늘',
    dateLabel: '9월 16일',
    title: '이순신 장군님의 명량대첩 대승리 🌊',
    summary: '"죽고자 하면 살고, 살고자 하면 죽는다!" 이순신 장군님은 단 12척의 배로 133척이 넘는 적의 대함대를 울돌목의 거센 바닷물을 이용해 물리치셨어요.',
    funFact: '울돌목은 물살이 얼마나 거센지 바위가 우는 소리가 난다고 해서 붙여진 이름이에요.',
  },
  {
    id: 'h5',
    period: '140여 년 전 오늘',
    dateLabel: '10월 21일',
    title: '에디슨이 어둠을 밝히는 전구를 완성했어요 💡',
    summary: '토머스 에디슨이 수천 번의 실패 끝에 40시간 넘게 타오르는 탄소 필라멘트 전구를 발명했어요. 덕분에 인류는 밤에도 낮처럼 환하게 생활할 수 있게 되었답니다.',
    funFact: '에디슨은 "천재는 1%의 영감과 99%의 땀으로 이루어진다"는 명언을 남겼어요.',
  },
  {
    id: 'h6',
    period: '50여 년 전 오늘',
    dateLabel: '7월 20일',
    title: '인류가 최초로 달 표면에 발자국을 남겼어요 🌕',
    summary: '아폴로 11호의 닐 암스트롱 선장이 "이것은 한 인간에게는 작은 한 걸음이지만, 인류에게는 거대한 도약이다"라는 말과 함께 달에 첫발을 디뎠어요.',
    funFact: '달에는 바람과 비가 없어서 당시 찍힌 우주 비행사의 발자국이 지금도 그대로 남아있답니다.',
  },
]

// 2. 오늘의 과학·우주 한 줄 (Kid-friendly Trivia & 왜 그럴까요?)
export const SCIENCE_TRIVIA = [
  {
    id: 's1',
    topic: '우주 · 천문 🌌',
    statement: '달은 매년 지구에서 3.8cm씩 멀어지고 있어요 🌕',
    question: '달이 왜 지구에서 조금씩 멀어질까요?',
    explanation:
      '지구와 달이 서로를 끌어당기는 조석력(밀물과 썰물) 때문이에요! 이 힘으로 인해 지구의 자전 속도가 아주 미세하게 느려지면서, 그 에너지가 달을 바깥쪽 궤도로 밀어내고 있답니다.',
  },
  {
    id: 's2',
    topic: '생물 · 곤충 🐜',
    statement: '개미는 자기 몸무게의 50배를 번쩍 들 수 있어요 🏋️',
    question: '개미는 작은 몸으로 어떻게 엄청난 힘을 낼까요?',
    explanation:
      '몸집이 작은 곤충은 자기 몸무게를 지탱하는 데 에너지가 거의 들지 않아요! 게다가 몸 크기에 비해 근육의 단면적이 사람보다 훨씬 넓어서, 사람으로 치면 승용차 2대를 거뜬히 드는 셈이랍니다.',
  },
  {
    id: 's3',
    topic: '우주 · 소리 🚀',
    statement: '우주 공간은 아무리 크게 소리쳐도 아무 소리도 안 들려요 🤫',
    question: '우주에서는 왜 소리가 들리지 않을까요?',
    explanation:
      '소리는 공기나 물 같은 물질(매질)이 떨려야 전달돼요. 하지만 우주는 공기가 전혀 없는 "진공 상태"라서 진동을 전해줄 친구가 없기 때문에 소리가 전혀 퍼지지 않아요!',
  },
  {
    id: 's4',
    topic: '바다 · 해양 🐙',
    statement: '문어는 심장이 3개나 있고, 피가 파란색이에요 💙',
    question: '문어 피는 왜 빨간색이 아니라 파란색일까요?',
    explanation:
      '사람의 피는 철(헤모글로빈)이 산소를 날라서 빨갛지만, 차가운 바다 깊은 곳에 사는 문어는 "구리(헤모시아닌)" 성분으로 산소를 날라요. 구리가 산소와 만나면 푸른빛을 띠기 때문에 파란 피가 된답니다!',
  },
  {
    id: 's5',
    topic: '식물 · 과일 🍌',
    statement: '바나나는 씨앗이 없는데 어떻게 나무에서 열릴까요? 🌱',
    question: '씨앗이 없는 바나나는 어떻게 자랄까요?',
    explanation:
      '우리가 먹는 달콤한 바나나는 씨가 없도록 품종을 개량한 것이에요. 대신 바나나 나무 밑동에서 돋아나는 "새순(뿌리줄기)"을 떼어내서 땅에 심으면 똑같은 바나나 나무가 자라난답니다!',
  },
  {
    id: 's6',
    topic: '지구 · 환경 🌈',
    statement: '비가 온 뒤 생기는 무지개는 원래 둥근 원 모양이에요 ⭕',
    question: '우리는 왜 무지개를 반원 모양으로만 볼까요?',
    explanation:
      '무지개는 공기 중 물방울에 햇빛이 반사되어 만들어지는 완전한 원형이에요! 하지만 우리가 땅 위에 서서 보면 지평선과 땅이 무지개 아랫부분을 가리기 때문에 활 모양의 반원처럼 보이는 것이랍니다. 높은 비행기에서는 동그란 무지개를 볼 수 있어요!',
  },
]

// 3. 오늘의 순우리말 & 실생활 영단어
export const KOREAN_WORDS = [
  {
    id: 'kw1',
    word: '윤슬',
    pronunciation: '윤슬',
    meaning: '햇빛이나 달빛에 비치어 반짝이는 잔물결',
    example: '노을 지는 강물 위에 반짝이는 윤슬이 보석처럼 예뻐요.',
  },
  {
    id: 'kw2',
    word: '너나들이',
    pronunciation: '너나들이',
    meaning: '서로 "너", "나" 하고 부르며 허물없이 지내는 다정한 사이',
    example: '새 학기 짝꿍과 금세 너나들이하는 소중한 단짝이 되었어요.',
  },
  {
    id: 'kw3',
    word: '시나브로',
    pronunciation: '시나브로',
    meaning: '모르는 사이에 조금씩 조금씩',
    example: '매일 책을 조금씩 읽다 보니 시나브로 생각이 깊어졌어요.',
  },
  {
    id: 'kw4',
    word: '라온',
    pronunciation: '라온',
    meaning: '"즐거운"을 뜻하는 따뜻하고 밝은 순우리말',
    example: '오늘 우리 가족 모두 라온 웃음이 가득한 하루를 보냈어요.',
  },
  {
    id: 'kw5',
    word: '온새미로',
    pronunciation: '온새미로',
    meaning: '가르거나 쪼개지 않고 본래 생긴 그대로 온전히',
    example: '숲속 자연의 모습을 온새미로 지켜주고 싶어요.',
  },
  {
    id: 'kw6',
    word: '도담도담',
    pronunciation: '도담도담',
    meaning: '어린아이가 탈 없이 무럭무럭 건강하게 자라는 모양',
    example: '우리 아이들이 도담도담 밝고 씩씩하게 자라고 있어요.',
  },
]

export const ENGLISH_WORDS = [
  {
    id: 'ew1',
    word: 'Catch up',
    pronunciation: '캐치 업',
    meaning: '밀린 이야기를 나누다 / 안부를 전하다',
    example: 'Let\'s catch up after school! (방과 후에 밀린 이야기하자!)',
  },
  {
    id: 'ew2',
    word: 'Chill out',
    pronunciation: '칠 아웃',
    meaning: '긴장을 풀고 편하게 푹 쉬다',
    example: 'Just chill out and take a deep breath. (긴장 풀고 심호흡해 봐.)',
  },
  {
    id: 'ew3',
    word: 'Piece of cake',
    pronunciation: '피스 오브 케이크',
    meaning: '식은 죽 먹기 / 아주 쉬운 일',
    example: 'This math puzzle is a piece of cake! (이 수학 퍼즐은 식은 죽 먹기야!)',
  },
  {
    id: 'ew4',
    word: 'Cheer up',
    pronunciation: '치어 업',
    meaning: '기운 내! 힘내!',
    example: 'Cheer up! You did your very best today. (기운 내! 오늘 최선을 다했어.)',
  },
  {
    id: 'ew5',
    word: 'High five',
    pronunciation: '하이 파이브',
    meaning: '손바닥을 마주치며 축하하는 인사',
    example: 'Give me a high five! We won the game! (하이파이브하자! 우리가 이겼어!)',
  },
  {
    id: 'ew6',
    word: 'Stand by me',
    pronunciation: '스탠 바이 미',
    meaning: '내 곁을 지켜주다 / 힘이 되어주다',
    example: 'Thank you for always standing by me. (언제나 내 곁을 지켜줘서 고마워.)',
  },
]

// 4. 오늘의 넌센스 퀴즈 & 생각 질문 (하브루타/사고력)
export const NONSENSE_QUIZZES = [
  {
    id: 'q1',
    question: '세상에서 가장 가난한 왕은 누구일까요? 👑',
    answer: '최저임금',
    hint: '돈과 관련된 단어예요!',
    emoji: '💸',
  },
  {
    id: 'q2',
    question: '왕이 길을 가다가 쿵! 넘어지면 무엇일까요? 👑',
    answer: '킹콩',
    hint: '영어로 왕(King)과 넘어지는 소리!',
    emoji: '🦍',
  },
  {
    id: 'q3',
    question: '포도가 처음 만난 친구에게 자기소개할 때 하는 말은? 🍇',
    answer: '포도당',
    hint: '"~입니다"를 귀엽게 발음해 보세요!',
    emoji: '🍬',
  },
  {
    id: 'q4',
    question: '소나무가 뾰로통하게 삐지면 무엇이 될까요? 🌲',
    answer: '칫솔 (치! + 솔)',
    hint: '양치할 때 쓰는 물건이에요!',
    emoji: '🪥',
  },
  {
    id: 'q5',
    question: '자동차가 길에서 엉엉 울면 무엇일까요? 🚗',
    answer: '잉카 (잉~ + Car)',
    hint: '고대 문명 이름이기도 해요!',
    emoji: '😭',
  },
  {
    id: 'q6',
    question: '세상에서 제일 착하고 남을 잘 돕는 사자는? 🦁',
    answer: '자원봉사자',
    hint: '끝 글자가 "~사자"예요!',
    emoji: '🤝',
  },
]

export const HAVRUTA_QUESTIONS = [
  {
    id: 'hav1',
    prompt: '만약 하루 동안 투명인간이 된다면, 오늘 하루 무엇을 가장 먼저 해보고 싶나요? 👻',
    guide: '정답은 없어요! 장난치고 싶은 일, 평소 가보고 싶었던 비밀 장소 등 자유롭게 상상해 보세요.',
  },
  {
    id: 'hav2',
    prompt: '친구에게 들었을 때 온종일 마음이 따뜻하고 가장 기분 좋았던 말은 무엇인가요? 💬',
    guide: '"고마워", "너랑 있으면 재밌어"처럼 작은 말 한마디가 준 힘을 떠올려 봐요.',
  },
  {
    id: 'hav3',
    prompt: '10년 후 어른이 된 나에게 딱 한 가지 질문이 담긴 편지를 보낸다면 뭐라고 물어볼까요? ✉️',
    guide: '내가 꿈꾸던 일을 하고 있는지, 지금 좋아하는 것은 그대로인지 물어보세요.',
  },
  {
    id: 'hav4',
    prompt: '우리 가족만을 위한 특별하고 재미있는 규칙을 딱 하나 만든다면 무엇이 좋을까요? 👨‍👩‍👧‍👦',
    guide: '"매주 금요일은 다 같이 좋아하는 노래 부르기"처럼 신나는 규칙을 생각해 보세요.',
  },
  {
    id: 'hav5',
    prompt: '동물들의 말을 알아듣는 마법 안경이 생긴다면, 가장 먼저 어떤 동물과 대화해보고 싶나요? 🐾',
    guide: '길고양이, 강아지, 하늘을 나는 새... 그 동물에게 무엇을 묻고 싶은가요?',
  },
]

/**
 * 날짜(일 단위)를 기준으로 순환하는 인덱스를 계산합니다.
 */
export function getDailyIndex(length, offset = 0) {
  if (!length) return 0
  const now = new Date()
  const dayCode = now.getFullYear() * 366 + (now.getMonth() + 1) * 31 + now.getDate()
  return (dayCode + offset) % length
}

/**
 * Web Speech API를 활용한 음성 발음 재생 (TTS)
 */
export function speakWord(text, lang = 'ko-KR') {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    alert('이 브라우저에서는 음성 듣기를 지원하지 않습니다.')
    return
  }
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.85
    utterance.pitch = 1.05
    window.speechSynthesis.speak(utterance)
  } catch (e) {
    console.warn('TTS 재생 실패:', e)
  }
}
