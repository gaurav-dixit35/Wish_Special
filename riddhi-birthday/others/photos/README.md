# Connected personal photos

Original JPG/JPEG photos are preserved in this folder. The site uses optimized
WebP copies (maximum 1200px long edge), with EXIF orientation applied:

| Original | Site copy |
| --- | --- |
| Bus.jpeg | 01-same-bus.webp |
| Kernala.jpeg | 02-kernala-fort.webp |
| Traditional.jpg | 03-traditional-day.webp |
| SGNP.jpeg | 04-sgnp.webp |
| IDE_Bootcamp.jpg | 05-ide-bootcamp.webp |
| GEN_Ai.jpg | 06-genai.webp |
| Aavishkar.jpg | 07-aavishkar.webp |
| Symposium.jpeg | 08-symposium.webp |
| Matheran.jpg | 09-matheran.webp |
| Beach.jpeg | 10-ganpati.webp |

Memory labels and captions are in `js/config.js`; labels have no emoji.
The Ganpati memory deliberately uses Beach.jpeg, as requested by the owner.
`extra-01.webp` through `extra-06.webp` reuse Bus, Kernala, Traditional Day,
SGNP, Matheran, and Beach for the six matching-game pairs (640px long edge).

Cards use 4:5 frames; opening a photo shows it uncropped in the lightbox.
No originals were cropped, overwritten, or removed. Refresh the site after
changing media so its preload cache is rebuilt.
