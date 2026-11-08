"""Encode generated cottage images and synthesize an original, seamless rain ambience."""
from pathlib import Path
import wave
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'cottage'
for name in ('room-background', 'room-mobile', 'sheep-seated'):
    with Image.open(ROOT / f'{name}.png') as image:
        image.save(ROOT / f'{name}.webp', 'WEBP', quality=92, method=6)

rate, seconds = 22050, 16
rng = np.random.default_rng(20261105)
count = rate * seconds
frequency = np.fft.rfftfreq(count, 1 / rate)
spectrum = np.fft.rfft(rng.normal(size=count))
color = 1 / np.sqrt(1 + frequency / 450)
color *= 1 - np.exp(-frequency / 120)
rain = np.fft.irfft(spectrum * color, n=count)
time = np.arange(count) / rate
rain *= .80 + .12 * np.sin(2 * np.pi * time / seconds) + .08 * np.cos(6 * np.pi * time / seconds)
rain /= max(np.max(np.abs(rain)), 1)
with wave.open(str(ROOT / 'rain.wav'), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes((rain * 12500).astype('<i2').tobytes())
