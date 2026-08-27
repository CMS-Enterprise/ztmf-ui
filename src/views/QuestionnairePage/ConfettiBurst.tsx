import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'

/**
 * Whether the current user has asked the operating system to minimize motion.
 * A one-shot celebratory animation with no way to opt out is an accessibility
 * gap, so the burst is suppressed when this is set. Guarded for environments
 * without matchMedia (older jsdom) so it degrades to "play the animation"
 * rather than throwing.
 * @returns {boolean} True when reduced motion is requested.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Fires a single confetti burst when it mounts. Rendered only at the moment a
 * questionnaire is fully answered.
 *
 * The library's default global canvas is appended to the body with no z-index,
 * so it paints behind the dialog that triggers it. Instead we render our own
 * full-screen canvas and drive it with confetti.create, which lets us stack it
 * above the modal layer.
 *
 * The canvas is portaled to the body so its position:fixed anchors to the
 * viewport rather than the dialog subtree, where a transformed ancestor (e.g. a
 * Grow/Slide dialog transition) would otherwise capture it. useWorker is off so
 * this instance owns its animation state and the unmount reset() cannot cancel
 * an unrelated confetti animation sharing the library's singleton worker.
 * Honors the reduced-motion preference.
 * @returns {React.ReactPortal} A viewport overlay canvas portaled to the body.
 */
export default function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const canvas = canvasRef.current
    if (!canvas) return
    const fire = confetti.create(canvas, { resize: true, useWorker: false })
    fire({
      particleCount: 120,
      spread: 180,
      origin: { y: 0.43 },
    })
    return () => {
      fire.reset()
    }
  }, [])

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        // Clear the MUI modal layer (z-index 1300) so the burst is not hidden
        // behind the dialog and its backdrop.
        zIndex: 2000,
      }}
    />,
    document.body
  )
}
