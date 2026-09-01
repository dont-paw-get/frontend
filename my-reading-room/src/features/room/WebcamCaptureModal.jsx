import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * WebcamCaptureModal — getUserMedia로 노트북/PC 웹캠 스트림을 띄우고
 * 셔터 버튼으로 정지 프레임을 캡처하는 모달 (CLIAR-210).
 *
 * `<input type="file" capture>`는 모바일에서는 OS 카메라 앱을 열어주지만
 * 데스크톱 브라우저에서는 무시되고 파일 탐색기만 뜬다. 이 모달은 그 공백을
 * 메워 데스크톱에서도 웹캠으로 즉석 촬영할 수 있게 한다(모바일은 기존
 * capture 입력을 그대로 사용하므로 이 컴포넌트와는 독립적인 대안 경로다).
 *
 * @param {(file: File) => void} onCapture - 캡처된 이미지를 File(image/jpeg)로 전달
 * @param {() => void} onClose - 닫기 콜백
 */
export default function WebcamCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('이 브라우저에서는 웹캠 기능을 지원하지 않아요.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        // 권한 거부/카메라 없음 등을 구분해 안내
        if (err?.name === 'NotAllowedError') {
          setError('카메라 권한이 거부됐어요. 브라우저 주소창의 카메라 권한을 허용해 주세요.');
        } else if (err?.name === 'NotFoundError') {
          setError('연결된 카메라를 찾을 수 없어요.');
        } else {
          setError('카메라를 여는 중 문제가 발생했어요.');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  }, [onClose]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }, [ready, onCapture]);

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 92vw)', background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', color: 'var(--text-h)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>📷 웹캠으로 촬영</h3>
          <button
            onClick={handleClose}
            style={{ border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {error ? (
          <p style={{ fontSize: 13, color: '#e05a4e', textAlign: 'center', padding: '32px 0' }}>{error}</p>
        ) : (
          <div
            style={{
              width: '100%', aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden',
              background: '#000', position: 'relative',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
            {!ready && (
              <span
                style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13,
                }}
              >
                카메라를 여는 중이에요...
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={handleCapture}
            disabled={!ready || !!error}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: ready && !error ? 'var(--accent)' : 'var(--border)',
              color: ready && !error ? '#fff' : 'var(--text)',
              fontWeight: 700, cursor: ready && !error ? 'pointer' : 'not-allowed', fontSize: 14,
            }}
          >
            📸 촬영
          </button>
          <button
            type="button"
            onClick={handleClose}
            style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-h)', cursor: 'pointer', fontSize: 14 }}
          >
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
