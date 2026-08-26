import { Component } from 'react';

/**
 * ErrorBoundary — 하위 트리에서 발생한 렌더/라이프사이클 에러를 잡아
 * 앱 전체가 하얗게 죽는 대신 안내 UI를 보여준다.
 *
 * @param {string} [label] - 어떤 영역인지(폴백 메시지에 노출)
 * @param {React.ReactNode} [fallback] - 커스텀 폴백 UI
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // 개발 중에는 콘솔로 원인 확인 (프로덕션 로깅 연동 지점)
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--text)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 40 }}>🙀</div>
        <p style={{ margin: 0, color: 'var(--text-h)', fontWeight: 600 }}>
          {this.props.label ? `${this.props.label} 표시 중 문제가 생겼어요냥` : '문제가 생겼어요냥'} 🐾
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>잠시 후 다시 시도해 주세요.</p>
        <button
          onClick={this.handleReset}
          style={{
            marginTop: 4,
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid var(--accent-border)',
            background: 'var(--accent-bg)',
            color: 'var(--text-h)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }
}
