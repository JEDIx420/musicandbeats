class LoopCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.startFrame = 0;
    this.totalFrames = 0;
    this.captured = 0;
    this.armed = false;
    this.buffers = null;
    this.channels = 2;
    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'arm') {
        this.startFrame = Math.max(0, Math.round(data.startFrame || 0));
        this.totalFrames = Math.max(1, Math.round(data.frames || 1));
        this.channels = Math.max(1, Math.min(2, data.channels || 2));
        this.buffers = Array.from({ length: this.channels }, () => new Float32Array(this.totalFrames));
        this.captured = 0;
        this.armed = true;
      } else if (data.type === 'cancel') {
        this.armed = false;
        this.buffers = null;
        this.captured = 0;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    const blockSize = input[0]?.length || output[0]?.length || 128;
    for (let c = 0; c < output.length; c++) {
      const out = output[c];
      const src = input[c] || input[0];
      if (src) out.set(src);
      else out.fill(0);
    }
    if (!this.armed || !this.buffers) return true;
    const blockStart = currentFrame;
    const blockEnd = blockStart + blockSize;
    const captureEnd = this.startFrame + this.totalFrames;
    if (blockEnd <= this.startFrame || blockStart >= captureEnd) return true;
    const from = Math.max(0, this.startFrame - blockStart);
    const to = Math.min(blockSize, captureEnd - blockStart);
    const writeOffset = Math.max(0, blockStart + from - this.startFrame);
    const count = Math.max(0, to - from);
    if (count > 0) {
      for (let c = 0; c < this.channels; c++) {
        const src = input[c] || input[0];
        if (src) this.buffers[c].set(src.subarray(from, to), writeOffset);
      }
      this.captured = Math.max(this.captured, writeOffset + count);
    }
    if (this.captured >= this.totalFrames) {
      this.armed = false;
      const payload = this.buffers.map(b => b.buffer);
      this.port.postMessage({ type: 'complete', channels: payload, frames: this.totalFrames }, payload);
      this.buffers = null;
    }
    return true;
  }
}
registerProcessor('loop-capture', LoopCaptureProcessor);
