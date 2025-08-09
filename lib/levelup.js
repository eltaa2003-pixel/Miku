import { createCanvas, loadImage } from 'canvas'; // Install this package with `npm install canvas`

export async function levelup(name, level) {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = '#f4f4f4'; // Light gray background
    ctx.fillRect(0, 0, width, height);

    // Load and draw image (if you have a specific background image)
    // const background = await loadImage('./path/to/background.jpg'); // Adjust path as needed
    // ctx.drawImage(background, 0, 0, width, height);

    // Draw level-up text
    ctx.fillStyle = '#333'; // Dark text color
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Level Up!', width / 2, height / 3);

    ctx.font = '30px Arial';
    ctx.fillText(`Congratulations, ${name}!`, width / 2, height / 2);
    ctx.fillText(`New Level: ${level}`, width / 2, height / 1.5);

    return canvas.toBuffer(); // Return the image buffer
}
