export class FrameProcessor {
  constructor() { this.stats = { processed: 0, dropped: 0 }; }

  validateSequence(frames = []) {
    const issues = [];
    if (!Array.isArray(frames)) return { ok: false, state: 'invalid', issues: ['Sequência de frames inválida.'], count: 0 };
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const cur = frames[i];
      if (cur?.timestamp != null && prev?.timestamp != null && Number(cur.timestamp) < Number(prev.timestamp)) {
        issues.push({ index: i, issue: 'out-of-order', message: 'Timestamp fora de ordem.' });
      }
      if (cur?.timestamp != null && prev?.timestamp != null && Number(cur.timestamp) === Number(prev.timestamp)) {
        issues.push({ index: i, issue: 'duplicate-timestamp', message: 'Timestamp duplicado.' });
      }
    }
    return { ok: issues.length === 0, state: issues.length ? 'invalid' : 'valid', issues, count: frames.length };
  }

  planInterpolation(inputFps, targetFps) {
    const inFps = Number(inputFps);
    const outFps = Number(targetFps);
    const valid = Number.isFinite(inFps) && inFps > 0 && Number.isFinite(outFps) && outFps > 0;
    const ratio = valid ? (outFps / inFps) : null;
    const framesPerGap = ratio && ratio > 1 ? Math.max(0, Math.round(ratio - 1)) : 0;
    return {
      inputFps: valid ? inFps : inputFps ?? null,
      targetFps: valid ? outFps : targetFps ?? null,
      ratio,
      framesPerGap,
      valid,
      note: 'Planejamento aproximado; execução real de interpolação requer engine/pipeline compatível.',
    };
  }
}

export default FrameProcessor;
