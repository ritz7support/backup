# Social Media Preview Image Setup

## Current Status
✅ Meta tags updated in `/app/frontend/public/index.html`
✅ Basic SVG preview image created at `/app/frontend/public/abcd-social-preview.svg`

## Meta Tags Added

### Open Graph (Facebook, LinkedIn, WhatsApp)
- `og:title` - ABCD Community - Connect, Learn & Grow Together
- `og:description` - Join ABCD - A vibrant community platform...
- `og:image` - Points to abcd-social-preview.png
- `og:type` - website
- `og:url` - https://app.abcd.ritz7.com/

### Twitter Card
- `twitter:card` - summary_large_image
- `twitter:title` - ABCD Community...
- `twitter:description` - Join ABCD...
- `twitter:image` - Points to abcd-social-preview.png

## Creating a Better Preview Image

### Option 1: Use Your Logo (Recommended)
If you have a logo file:
1. Create an image 1200x630 pixels (required size for social media)
2. Add your logo + tagline
3. Save as `abcd-social-preview.png`
4. Place in `/app/frontend/public/`

### Option 2: Use Canva (Free & Easy)
1. Go to canva.com
2. Search for "Facebook Post" template (1200x630px)
3. Design with:
   - ABCD branding
   - Your community name
   - Tagline: "Connect, Learn & Grow Together"
   - Your colors (#0462CB blue gradient)
4. Download as PNG
5. Name it `abcd-social-preview.png`
6. Upload to `/app/frontend/public/`

### Option 3: Use Figma (Professional)
1. Create 1200x630 artboard
2. Design preview image
3. Export as PNG
4. Place in `/app/frontend/public/`

## Current Placeholder
- A simple SVG has been created
- For best results, replace with a proper PNG image
- Recommended dimensions: 1200x630 pixels
- File name: `abcd-social-preview.png`

## Testing Your Meta Tags

### Facebook Debugger
https://developers.facebook.com/tools/debug/
- Enter your URL: https://app.abcd.ritz7.com
- Click "Scrape Again" to refresh cache

### Twitter Card Validator
https://cards-dev.twitter.com/validator
- Enter your URL
- See preview

### LinkedIn Post Inspector
https://www.linkedin.com/post-inspector/
- Enter your URL
- Check how it appears

## What Will Show When Sharing

**Title:** ABCD Community - Connect, Learn & Grow Together

**Description:** Join ABCD - A vibrant community platform for learners, mentors, and innovators. Engage in discussions, share knowledge, and build meaningful connections.

**Image:** Your custom preview image (1200x630px)

**URL:** https://app.abcd.ritz7.com/

## After Deployment

1. Deploy your updated code
2. Share a link to test
3. Use Facebook Debugger or Twitter Validator to verify
4. If needed, "Scrape Again" to clear old cache

## Notes
- Social platforms cache meta tags, so changes may take time to appear
- Always use absolute URLs for images
- PNG format works best for social media previews
- Image should be under 8MB
