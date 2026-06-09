---
description: Create a dual digital/physical business card from an SNS profile
---

When the user asks to "create a business card" or provides an SNS URL for a personal/brand identity:

1. **Research & Extract**: Use `browser_subagent` to visit the SNS profile. Extract the name, bio, **official website URL (if available)**, and visual "vibe" (colors, themes).
2. **Generate Hero Image**: Use `generate_image` to create a premium, high-resolution background that matches the extracted vibe.
3. **Build Digital LP**:
    - Create a new directory under `yuuta/`.
    - Implement a mobile-first, vertical "Linktree-style" LP.
    - Use glassmorphism and modern typography.
    - **Include buttons for the official website, SNS, and other key links.**
4. **Build Physical Card Design**:
    - Inside the SAME digital LP, add a "Print Card" section.
    - Use pure HTML/CSS to render a Front and Back card with the standard business card ratio (91x55mm).
    - **Include the official website URL on the back of the card.**
    - ensure the Back card includes a QR code.
5. **Dynamic QR Code**: Use JavaScript in `index.html` to auto-generate a QR code for the current URL (`window.location.href`) so it works regardless of the deployment domain.
6. **Deploy & QR Integration**:
    - Run `deploy.sh`.
    - Notify the user with the URL and remind them they can long-press the physical card previews to save them for printing.
