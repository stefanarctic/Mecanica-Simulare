import { BoxCollider } from './Collider.js';

class GameObject {
    x = 0;
    y = 0;
    width = 30;
    height = 30;
    spriteSrc = '';
    color = '#ffffff';
    hasGravity = true;
    vx = 0; // velocity x
    vy = 0; // velocity y
    ax = 0; // acceleration x
    ay = 0; // acceleration y
    mass = 1; // mass in kg
    forces = []; // array of {x, y} force vectors
    collider = null;
    rotation = 0;
    constructor(x = 0, y = 0, width = 30, height = 30, mass = 1, collider = null)
    {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.mass = mass;
        this.forces = [];
        this.collider = collider;
    }
}

export default GameObject;