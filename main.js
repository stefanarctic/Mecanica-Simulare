import GameObject from './components/GameObject.js';
import { BoxCollider, CircleCollider, TriangleCollider } from './components/Collider.js';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;
const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
const tickrate = 60; // Frames per second
const tickInterval = 1000 / tickrate; // Interval in milliseconds
let lastTime = 0;

const gameObjects = [];
const loadedImages = new Map(); // Store pre-loaded images

const PPM = 100; // Pixels per meter
const GRAVITY = 9.8 * PPM; // 9.8 m/s^2 in pixels

const preloadImage = (src) => {
    return new Promise((resolve, reject) => {
        if (loadedImages.has(src)) {
            resolve(loadedImages.get(src));
            return;
        }

        const img = new Image();
        img.onload = () => {
            loadedImages.set(src, img);
            resolve(img);
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            reject(new Error(`Failed to load image: ${src}`));
        };
        img.src = src;
    });
};

const preloadGameObjectImages = async () => {
    const imagePromises = gameObjects
        .filter(obj => obj.spriteSrc)
        .map(obj => preloadImage(obj.spriteSrc));

    try {
        await Promise.all(imagePromises);
        console.log('All images pre-loaded successfully');
    } catch (error) {
        console.error('Error pre-loading images:', error);
    }
};

const init = async () => {
    console.log('Initiating simulation...');

    const heavy = new GameObject(650, 100, 30, 30, 7, new BoxCollider(0, 0, 30, 30)); // mass = 10
    const light = new GameObject(700, 350, 30, 30, 3, new BoxCollider(0, 0, 30, 30));  // mass = 1
    const ball = new GameObject(510, 20, 60, 60, 5, new CircleCollider(0, 0, 30)); // mass = 2, radius = 15
    ball.spriteSrc = 'public/res/basketball.png';
    // Triangle vertices: top, bottom-left, bottom-right
    const triangleVerts = [
        { x: 0, y: 300 },    // bottom-left (right angle)
        { x: 0, y: 0 },      // top-left
        { x: 600, y: 300 }   // bottom-right
    ];
    const triangle = new GameObject(450, height - 300, 600, 300, 100, new TriangleCollider(triangleVerts, 0, 0));
    triangle.hasGravity = false;
    triangle.color = '#ff0000'; // red fill
    heavy.color = '#00ff00';
    light.color = '#0000ff';
    ball.color = '#ffff00'; // yellow ball
    gameObjects.push(heavy, light, ball, triangle);

    // Pre-load all images before starting the game loop
    await preloadGameObjectImages();

    runUpdateLoop();
}

const runUpdateLoop = (timestamp) => {
    if (timestamp - lastTime >= tickInterval) {
        lastTime = timestamp;
        update();
    }

    requestAnimationFrame(runUpdateLoop);
}

// Collider-based collision detection
function isColliding(a, b) {
    if (a.collider && b.collider) {
        return a.collider.isCollidingWith(b.collider, a, b);
    }
    return false;
}

// Helper: Closest point on segment and triangle
function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: ax + abx * t, y: ay + aby * t };
}

function closestPointOnTriangle(px, py, verts) {
    let closest = null;
    let minDistSq = Infinity;
    for (let i = 0; i < 3; i++) {
        const v1 = verts[i];
        const v2 = verts[(i + 1) % 3];
        const pt = closestPointOnSegment(px, py, v1.x, v1.y, v2.x, v2.y);
        const dx = px - pt.x;
        const dy = py - pt.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
            minDistSq = distSq;
            closest = pt;
        }
    }
    // Also check if the point is inside the triangle
    if (typeof TriangleCollider !== 'undefined' && TriangleCollider.pointInTriangle(px, py, ...verts)) {
        return { x: px, y: py };
    }
    return closest;
}

// Simple collision resolution: stop objects from overlapping and zero their velocities
function resolveCollision(a, b) {
    // Advanced triangle collision resolution
    // If a is triangle and b is dynamic
    if (a.collider && a.collider.type === 'triangle' && b.collider && b.hasGravity) {
        if (b.collider.type === 'circle') {
            // Get triangle world vertices
            const verts = a.collider.vertices.map(v => ({
                x: a.x + a.collider.offsetX + v.x,
                y: a.y + a.collider.offsetY + v.y
            }));
            const cx = b.x + b.collider.offsetX + b.collider.radius;
            const cy = b.y + b.collider.offsetY + b.collider.radius;
            const closest = closestPointOnTriangle(cx, cy, verts);
            const dx = cx - closest.x;
            const dy = cy - closest.y;
            const dist = Math.hypot(dx, dy);
            const overlap = b.collider.radius - dist;
            if (overlap > 0) {
                // Normalized normal
                const nx = dx / dist;
                const ny = dy / dist;
                // Push out
                b.x += nx * overlap;
                b.y += ny * overlap;
                // Reflect velocity (remove normal component, keep tangential)
                const vDotN = b.vx * nx + b.vy * ny;
                if (vDotN < 0) {
                    const damping = 1;
                    b.vx = (b.vx - vDotN * nx) * damping;
                    b.vy = (b.vy - vDotN * ny) * damping;
                }
            }
            return;
        }
        // For boxes, use the existing behavior
        if (b.collider.type === 'box') {
            const center = {
                x: b.x + b.width / 2,
                y: b.y + b.height / 2
            };
            const normal = a.collider.getClosestSurfaceNormal(center, a);
            b.x += normal.x * 2;
            b.y += normal.y * 2;
            // Zero velocity along the normal
            const vDotN = b.vx * normal.x + b.vy * normal.y;
            if (vDotN < 0) {
                b.vx -= vDotN * normal.x;
                b.vy -= vDotN * normal.y;
            }
            // Set rotation to match the slope (only for boxes)
            b.rotation = Math.atan2(normal.y, normal.x) - Math.PI / 2;
            return;
        }
    }
    // If b is triangle and a is dynamic
    if (b.collider && b.collider.type === 'triangle' && a.collider && a.hasGravity) {
        if (a.collider.type === 'circle') {
            // Get triangle world vertices
            const verts = b.collider.vertices.map(v => ({
                x: b.x + b.collider.offsetX + v.x,
                y: b.y + b.collider.offsetY + v.y
            }));
            const cx = a.x + a.collider.offsetX + a.collider.radius;
            const cy = a.y + a.collider.offsetY + a.collider.radius;
            const closest = closestPointOnTriangle(cx, cy, verts);
            const dx = cx - closest.x;
            const dy = cy - closest.y;
            const dist = Math.hypot(dx, dy);
            const overlap = a.collider.radius - dist;
            if (overlap > 0) {
                // Normalized normal
                const nx = dx / dist;
                const ny = dy / dist;
                // Push out
                a.x += nx * overlap;
                a.y += ny * overlap;
                // Reflect velocity (remove normal component, keep tangential)
                const vDotN = a.vx * nx + a.vy * ny;
                if (vDotN < 0) {
                    const damping = 1;
                    a.vx = (a.vx - vDotN * nx) * damping;
                    a.vy = (a.vy - vDotN * ny) * damping;
                }
            }
            return;
        }
        // For boxes, use the existing behavior
        if (a.collider.type === 'box') {
            const center = {
                x: a.x + a.width / 2,
                y: a.y + a.height / 2
            };
            const normal = b.collider.getClosestSurfaceNormal(center, b);
            a.x += normal.x * 2;
            a.y += normal.y * 2;
            // Zero velocity along the normal
            const vDotN = a.vx * normal.x + a.vy * normal.y;
            if (vDotN < 0) {
                a.vx -= vDotN * normal.x;
                a.vy -= vDotN * normal.y;
            }
            // Set rotation to match the slope (only for boxes)
            a.rotation = Math.atan2(normal.y, normal.x) - Math.PI / 2;
            return;
        }
    }
    // Default: old box/box, circle/circle, etc
    // Find the overlap on both axes
    const overlapX = (a.x + a.width / 2) - (b.x + b.width / 2);
    const overlapY = (a.y + a.height / 2) - (b.y + b.height / 2);
    const halfWidths = (a.width + b.width) / 2;
    const halfHeights = (a.height + b.height) / 2;

    // Only resolve if overlapping
    if (Math.abs(overlapX) < halfWidths && Math.abs(overlapY) < halfHeights) {
        // Find the smallest overlap
        const dx = halfWidths - Math.abs(overlapX);
        const dy = halfHeights - Math.abs(overlapY);
        const totalMass = a.mass + b.mass;
        const aShare = b.mass / totalMass; // Heavier object moves less
        const bShare = a.mass / totalMass;

        if (dx < dy) {
            // Resolve along x
            if (overlapX > 0) {
                a.x += dx * aShare;
                b.x -= dx * bShare;
            } else {
                a.x -= dx * aShare;
                b.x += dx * bShare;
            }
            a.vx = 0;
            b.vx = 0;
        } else {
            // Resolve along y
            if (overlapY > 0) {
                a.y += dy * aShare;
                b.y -= dy * bShare;
            } else {
                a.y -= dy * aShare;
                b.y += dy * bShare;
            }
            a.vy = 0;
            b.vy = 0;
        }
    }
}

const update = () => {
    // Calculate deltaTime in seconds for smooth physics
    const deltaTime = tickInterval / 1000; // Fixed timestep for simplicity

    // Apply forces and update physics for each object
    gameObjects.forEach(obj => {
        if (obj.hasGravity) {
            // Clear forces
            obj.forces = [];
            // Add gravity as a force
            obj.forces.push({ x: 0, y: obj.mass * GRAVITY });
        }
        // Sum all forces
        let totalForceX = 0;
        let totalForceY = 0;
        for (const force of obj.forces) {
            totalForceX += force.x;
            totalForceY += force.y;
        }
        // Set acceleration based on total force and mass
        obj.ax = totalForceX / obj.mass;
        obj.ay = totalForceY / obj.mass;
        // Integrate velocity and position
        obj.vy += obj.ay * deltaTime;
        obj.vx += obj.ax * deltaTime;
        obj.x += obj.vx * deltaTime;
        obj.y += obj.vy * deltaTime;

        // Add rotation based on horizontal velocity for circles
        if (obj.collider && obj.collider.type === 'circle') {
            // Angular velocity is linear velocity / radius
            // Note: rotation increases clockwise in canvas context
            const angularVelocity = obj.vx / obj.collider.radius;
            obj.rotation += angularVelocity * deltaTime;
        }

        // Simple ground collision (optional)
        if (obj.y + obj.height > height) {
            obj.y = height - obj.height;
            obj.vy = 0;
        }
    });

    // Check collisions between all pairs
    for (let i = 0; i < gameObjects.length; i++) {
        for (let j = i + 1; j < gameObjects.length; j++) {
            if (isColliding(gameObjects[i], gameObjects[j])) {
                resolveCollision(gameObjects[i], gameObjects[j]);
            }
        }
    }

    render();
}

const render = () => {
    // Draw the background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    gameObjects.forEach(obj => {
        // Draw the object (rectangle, circle, or triangle)
        if (obj.spriteSrc && loadedImages.has(obj.spriteSrc)) {
            const img = loadedImages.get(obj.spriteSrc);

            ctx.save(); // Save the current canvas state

            if (obj.collider && obj.collider.type === 'circle') {
                // Translate to the center of the circle for rotation
                ctx.translate(obj.x + obj.collider.offsetX + obj.collider.radius, obj.y + obj.collider.offsetY + obj.collider.radius);
                // Apply rotation
                ctx.rotate(obj.rotation || 0);
                // Draw the image centered on the translated point
                ctx.drawImage(img, -obj.collider.radius, -obj.collider.radius, obj.collider.radius * 2, obj.collider.radius * 2);
            } else if (obj.collider && obj.collider.type === 'box') {
                // Translate to the center of the box for rotation
                ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
                // Apply rotation
                ctx.rotate(obj.rotation || 0);
                // Draw the image centered on the translated point
                ctx.drawImage(img, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
            } else {
                // For objects without specific collider rendering (or non-sprite), just draw the image
                ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
            }

            ctx.restore(); // Restore the saved canvas state

        } else {
            ctx.fillStyle = obj.color || '#ffffff';
            if (obj.collider && obj.collider.type === 'circle') {
                // Draw circle
                ctx.beginPath();
                ctx.arc(
                    obj.x + obj.collider.offsetX + obj.collider.radius,
                    obj.y + obj.collider.offsetY + obj.collider.radius,
                    obj.collider.radius,
                    0, Math.PI * 2
                );
                ctx.fill();
            } else if (obj.collider && obj.collider.type === 'triangle') {
                // Draw triangle
                ctx.beginPath();
                const verts = obj.collider.vertices;
                ctx.moveTo(obj.x + obj.collider.offsetX + verts[0].x, obj.y + obj.collider.offsetY + verts[0].y);
                ctx.lineTo(obj.x + obj.collider.offsetX + verts[1].x, obj.y + obj.collider.offsetY + verts[1].y);
                ctx.lineTo(obj.x + obj.collider.offsetX + verts[2].x, obj.y + obj.collider.offsetY + verts[2].y);
                ctx.closePath();
                ctx.fill();
            } else if (obj.collider && obj.collider.type === 'box') {
                // Draw rectangle with rotation
                ctx.save();
                ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
                ctx.rotate(obj.rotation || 0);
                ctx.fillRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
                ctx.restore();
            } else {
                // Draw rectangle
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            }
        }
        // Visualize collider outline (uncomment to enable)
        // if (obj.collider) {
        //     ctx.save();
        //     ctx.strokeStyle = '#00ff00';
        //     ctx.lineWidth = 2;
        //     ctx.setLineDash([4, 2]);
        //     if (obj.collider.type === 'box') {
        //         ctx.strokeRect(
        //             obj.x + obj.collider.offsetX,
        //             obj.y + obj.collider.offsetY,
        //             obj.collider.width,
        //             obj.collider.height
        //         );
        //     } else if (obj.collider.type === 'circle') {
        //         ctx.beginPath();
        //         ctx.arc(
        //             obj.x + obj.collider.offsetX + obj.collider.radius,
        //             obj.y + obj.collider.offsetY + obj.collider.radius,
        //             obj.collider.radius,
        //             0, Math.PI * 2
        //         );
        //         ctx.stroke();
        //     } else if (obj.collider.type === 'triangle') {
        //         ctx.beginPath();
        //         const verts = obj.collider.vertices;
        //         ctx.moveTo(obj.x + obj.collider.offsetX + verts[0].x, obj.y + obj.collider.offsetY + verts[0].y);
        //         ctx.lineTo(obj.x + obj.collider.offsetX + verts[1].x, obj.y + obj.collider.offsetY + verts[1].y);
        //         ctx.lineTo(obj.x + obj.collider.offsetX + verts[2].x, obj.y + obj.collider.offsetY + verts[2].y);
        //         ctx.closePath();
        //         ctx.stroke();
        //     }
        //     ctx.restore();
        // }
    });
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.scale(dpr, dpr);
}

window.onload = init;
window.onresize = resizeCanvas;
resizeCanvas(); // Call once at start