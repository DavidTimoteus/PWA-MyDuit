import os
import re
import subprocess

# 1. Update public/favicon.svg dengan signature green gradient
svg_path = "public/favicon.svg"
with open(svg_path, "r", encoding="utf-8") as f:
    svg = f.read()

old_bg = """    <!-- Background squircle gradient: biru indigo modern -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A8A"/>
      <stop offset="60%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>"""

new_bg = """    <!-- Background squircle gradient: signature emerald forest green -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1B4332"/>
      <stop offset="55%" stop-color="#2D6A4F"/>
      <stop offset="100%" stop-color="#40916C"/>
    </linearGradient>"""

if old_bg in svg:
    svg = svg.replace(old_bg, new_bg)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print("favicon.svg updated with signature green gradient!")
