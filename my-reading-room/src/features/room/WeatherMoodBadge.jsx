/**
 * WeatherMoodBadge — 사서 응답의 signals(날씨·시간대·무드)를 컨텍스트 뱃지로 표시.
 *
 * location_source 규칙:
 *  - "user":          사용자 실제 좌표 → 정확한 온도까지 표시 ("18°C ☔")
 *  - "default_seoul": 서울 대체 조회 → "📍서울 기준" 보조 문구, 온도 대신 설명 위주
 *  - "text_stated":   메시지에 직접 언급 → 온도 null, 설명만
 *  - "none":          날씨 정보 없음 → 날씨 뱃지 미표시
 *
 * @param {object|null} signals - { weather, time_of_day, mood, genre_focus }
 */

const WEATHER_EMOJI = {
  clear: '☀️',
  cloudy: '☁️',
  rainy: '☔',
  snowy: '❄️',
  stormy: '⛈️',
  foggy: '🌫️',
};

const TIME_LABEL = {
  dawn: '새벽',
  day: '낮',
  evening: '저녁',
  night: '밤',
};

const MOOD_LABEL = {
  cozy: '아늑한',
  adventurous: '모험적인',
  reflective: '사색적인',
  dreamy: '몽환적인',
  thrilling: '짜릿한',
  calm: '차분한',
};

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 9px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--code-bg)',
  color: 'var(--text-h)',
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

export default function WeatherMoodBadge({ signals }) {
  if (!signals) return null;

  const { weather, time_of_day: timeOfDay, mood, genre_focus: genreFocus } = signals;
  const chips = [];

  // 날씨 칩 (condition이 있고 none이 아닐 때만)
  if (weather && weather.condition && weather.location_source !== 'none') {
    const emoji = WEATHER_EMOJI[weather.condition] || '🌡️';
    const desc = weather.description || '';
    const source = weather.location_source;

    // "user"이고 온도가 있을 때만 온도 표시 (기상 모델 추정치라 근사 표시 '≈')
    const showTemp = source === 'user' && weather.temperature != null;
    const tempText = showTemp ? ` ≈${Math.round(weather.temperature)}°C` : '';

    chips.push(
      <span
        key="weather"
        style={chipStyle}
        title={showTemp ? '기상 모델 기반 추정치예요. 실제 관측값과 2~3°C 차이가 있을 수 있어요.' : undefined}
      >
        {emoji} {desc}{tempText}
        {source === 'default_seoul' && (
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>· 📍서울 기준</span>
        )}
      </span>
    );
  }

  // 시간대 칩
  if (timeOfDay && TIME_LABEL[timeOfDay]) {
    chips.push(
      <span key="time" style={chipStyle}>
        🕒 {TIME_LABEL[timeOfDay]}
      </span>
    );
  }

  // 무드 칩
  if (mood && MOOD_LABEL[mood]) {
    chips.push(
      <span key="mood" style={chipStyle}>
        {MOOD_LABEL[mood]} 분위기
      </span>
    );
  }

  // 장르 포커스 칩
  if (genreFocus) {
    chips.push(
      <span key="genre" style={{ ...chipStyle, borderColor: 'var(--accent-border)', background: 'var(--accent-bg)' }}>
        📚 {genreFocus}
      </span>
    );
  }

  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
      {chips}
    </div>
  );
}
