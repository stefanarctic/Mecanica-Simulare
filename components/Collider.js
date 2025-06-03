// Collider base class
class Collider {
    constructor(type) {
        this.type = type;
    }
    // Override in subclasses
    isCollidingWith(other, selfObj, otherObj) {
        throw new Error('isCollidingWith not implemented');
    }
}

// Rectangle (AABB) collider
class BoxCollider extends Collider {
    constructor(offsetX = 0, offsetY = 0, width = 30, height = 30) {
        super('box');
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.width = width;
        this.height = height;
    }
    // AABB vs AABB or AABB vs Circle or AABB vs Triangle
    isCollidingWith(other, selfObj, otherObj) {
        if (other.type === 'box') {
            const a = this;
            const b = other;
            const ax = selfObj.x + a.offsetX;
            const ay = selfObj.y + a.offsetY;
            const bx = otherObj.x + b.offsetX;
            const by = otherObj.y + b.offsetY;
            return (
                ax < bx + b.width &&
                ax + a.width > bx &&
                ay < by + b.height &&
                ay + a.height > by
            );
        } else if (other.type === 'circle') {
            // Box vs Circle
            const rect = this;
            const circle = other;
            const rx = selfObj.x + rect.offsetX;
            const ry = selfObj.y + rect.offsetY;
            const cx = otherObj.x + circle.offsetX + circle.radius;
            const cy = otherObj.y + circle.offsetY + circle.radius;
            // Find closest point on rect to circle center
            const closestX = Math.max(rx, Math.min(cx, rx + rect.width));
            const closestY = Math.max(ry, Math.min(cy, ry + rect.height));
            const dx = cx - closestX;
            const dy = cy - closestY;
            return (dx * dx + dy * dy) < (circle.radius * circle.radius);
        } else if (other.type === 'triangle') {
            // Box vs Triangle (simple approach: check if any triangle vertex is in box or box corner in triangle)
            return other.isCollidingWith(this, otherObj, selfObj);
        }
        return false;
    }
}

// Circle collider
class CircleCollider extends Collider {
    constructor(offsetX = 0, offsetY = 0, radius = 15) {
        super('circle');
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.radius = radius;
    }
    // Circle vs Circle or Circle vs Box or Circle vs Triangle
    isCollidingWith(other, selfObj, otherObj) {
        if (other.type === 'circle') {
            const a = this;
            const b = other;
            const ax = selfObj.x + a.offsetX + a.radius;
            const ay = selfObj.y + a.offsetY + a.radius;
            const bx = otherObj.x + b.offsetX + b.radius;
            const by = otherObj.y + b.offsetY + b.radius;
            const dx = ax - bx;
            const dy = ay - by;
            const rSum = a.radius + b.radius;
            return (dx * dx + dy * dy) < (rSum * rSum);
        } else if (other.type === 'box') {
            // Delegate to box's logic
            return other.isCollidingWith(this, otherObj, selfObj);
        } else if (other.type === 'triangle') {
            // Circle vs Triangle collision
            const cx = selfObj.x + this.offsetX + this.radius;
            const cy = selfObj.y + this.offsetY + this.radius;
            
            // Get world vertices for triangle
            const verts = other.vertices.map(v => ({
                x: otherObj.x + other.offsetX + v.x,
                y: otherObj.y + other.offsetY + v.y
            }));
            
            // Check if circle center is inside triangle
            if (TriangleCollider.pointInTriangle(cx, cy, ...verts)) {
                return true;
            }
            
            // Check if circle intersects with any triangle edge
            for (let i = 0; i < 3; i++) {
                const v1 = verts[i];
                const v2 = verts[(i + 1) % 3];
                
                // Vector from v1 to v2
                const edge = {
                    x: v2.x - v1.x,
                    y: v2.y - v1.y
                };
                
                // Vector from v1 to circle center
                const toCircle = {
                    x: cx - v1.x,
                    y: cy - v1.y
                };
                
                // Project circle center onto edge
                const edgeLength = Math.hypot(edge.x, edge.y);
                const edgeUnit = {
                    x: edge.x / edgeLength,
                    y: edge.y / edgeLength
                };
                
                const projection = toCircle.x * edgeUnit.x + toCircle.y * edgeUnit.y;
                const projectionClamped = Math.max(0, Math.min(projection, edgeLength));
                
                // Closest point on edge to circle center
                const closestPoint = {
                    x: v1.x + edgeUnit.x * projectionClamped,
                    y: v1.y + edgeUnit.y * projectionClamped
                };
                
                // Check distance from closest point to circle center
                const dx = cx - closestPoint.x;
                const dy = cy - closestPoint.y;
                const distanceSquared = dx * dx + dy * dy;
                
                if (distanceSquared < this.radius * this.radius) {
                    return true;
                }
            }
            return false;
        }
        return false;
    }
}

// Triangle collider (vertices are relative to GameObject position)
class TriangleCollider extends Collider {
    constructor(vertices = [{x:0,y:0},{x:30,y:0},{x:15,y:30}], offsetX = 0, offsetY = 0) {
        super('triangle');
        this.vertices = vertices; // Array of 3 points: [{x, y}, ...]
        this.offsetX = offsetX;
        this.offsetY = offsetY;
    }
    // Helper: point in triangle
    static pointInTriangle(px, py, v0, v1, v2) {
        const dX = px - v2.x;
        const dY = py - v2.y;
        const dX21 = v2.x - v1.x;
        const dY12 = v1.y - v2.y;
        const D = dY12 * (v0.x - v2.x) + dX21 * (v0.y - v2.y);
        const s = dY12 * dX + dX21 * dY;
        const t = (v2.y - v0.y) * dX + (v0.x - v2.x) * dY;
        if (D < 0) return s <= 0 && t <= 0 && s + t >= D;
        return s >= 0 && t >= 0 && s + t <= D;
    }
    // Triangle vs Triangle, Box, Circle
    isCollidingWith(other, selfObj, otherObj) {
        // Get world vertices for this triangle
        const vertsA = this.vertices.map(v => ({
            x: selfObj.x + this.offsetX + v.x,
            y: selfObj.y + this.offsetY + v.y
        }));
        if (other.type === 'triangle') {
            const vertsB = other.vertices.map(v => ({
                x: otherObj.x + other.offsetX + v.x,
                y: otherObj.y + other.offsetY + v.y
            }));
            // Check if any vertex of A in B or B in A
            for (const va of vertsA) {
                if (TriangleCollider.pointInTriangle(va.x, va.y, ...vertsB)) return true;
            }
            for (const vb of vertsB) {
                if (TriangleCollider.pointInTriangle(vb.x, vb.y, ...vertsA)) return true;
            }
            return false;
        } else if (other.type === 'box') {
            // Check if any triangle vertex is in box
            const bx = otherObj.x + other.offsetX;
            const by = otherObj.y + other.offsetY;
            for (const va of vertsA) {
                if (
                    va.x >= bx && va.x <= bx + other.width &&
                    va.y >= by && va.y <= by + other.height
                ) return true;
            }
            // Or if any box corner is in triangle
            const boxCorners = [
                {x: bx, y: by},
                {x: bx + other.width, y: by},
                {x: bx, y: by + other.height},
                {x: bx + other.width, y: by + other.height}
            ];
            for (const corner of boxCorners) {
                if (TriangleCollider.pointInTriangle(corner.x, corner.y, ...vertsA)) return true;
            }
            return false;
        } else if (other.type === 'circle') {
            // Circle vs Triangle collision
            const cx = otherObj.x + other.offsetX + other.radius;
            const cy = otherObj.y + other.offsetY + other.radius;
            
            // Get world vertices for triangle
            const verts = this.vertices.map(v => ({
                x: selfObj.x + this.offsetX + v.x,
                y: selfObj.y + this.offsetY + v.y
            }));
            
            // Check if circle center is inside triangle
            if (TriangleCollider.pointInTriangle(cx, cy, ...verts)) {
                return true;
            }
            
            // Check if circle intersects with any triangle edge
            for (let i = 0; i < 3; i++) {
                const v1 = verts[i];
                const v2 = verts[(i + 1) % 3];
                
                // Vector from v1 to v2
                const edge = {
                    x: v2.x - v1.x,
                    y: v2.y - v1.y
                };
                
                // Vector from v1 to circle center
                const toCircle = {
                    x: cx - v1.x,
                    y: cy - v1.y
                };
                
                // Project circle center onto edge
                const edgeLength = Math.hypot(edge.x, edge.y);
                const edgeUnit = {
                    x: edge.x / edgeLength,
                    y: edge.y / edgeLength
                };
                
                const projection = toCircle.x * edgeUnit.x + toCircle.y * edgeUnit.y;
                const projectionClamped = Math.max(0, Math.min(projection, edgeLength));
                
                // Closest point on edge to circle center
                const closestPoint = {
                    x: v1.x + edgeUnit.x * projectionClamped,
                    y: v1.y + edgeUnit.y * projectionClamped
                };
                
                // Check distance from closest point to circle center
                const dx = cx - closestPoint.x;
                const dy = cy - closestPoint.y;
                const distanceSquared = dx * dx + dy * dy;
                
                if (distanceSquared < other.radius * other.radius) {
                    return true;
                }
            }
            return false;
        }
        return false;
    }
    getClosestSurfaceNormal(point, selfObj) {
        // Get world vertices
        const verts = this.vertices.map(v => ({
            x: selfObj.x + this.offsetX + v.x,
            y: selfObj.y + this.offsetY + v.y
        }));
        let minDist = Infinity;
        let closestNormal = {x: 0, y: 0};
        for (let i = 0; i < 3; i++) {
            const v1 = verts[i];
            const v2 = verts[(i + 1) % 3];
            // Edge vector
            const edge = {x: v2.x - v1.x, y: v2.y - v1.y};
            // Outward normal (perpendicular)
            const normal = {x: edge.y, y: -edge.x};
            // Normalize
            const len = Math.hypot(normal.x, normal.y);
            normal.x /= len;
            normal.y /= len;
            // Distance from point to edge (project point onto normal)
            const px = point.x - v1.x;
            const py = point.y - v1.y;
            const dist = px * normal.x + py * normal.y;
            if (Math.abs(dist) < Math.abs(minDist)) {
                minDist = dist;
                closestNormal = normal;
            }
        }
        return closestNormal;
    }
    getPenetrationInfo(point, selfObj) {
        const verts = this.vertices.map(v => ({
            x: selfObj.x + this.offsetX + v.x,
            y: selfObj.y + this.offsetY + v.y
        }));
        let minDist = Infinity;
        let closestNormal = {x: 0, y: 0};
        for (let i = 0; i < 3; i++) {
            const v1 = verts[i];
            const v2 = verts[(i + 1) % 3];
            const edge = {x: v2.x - v1.x, y: v2.y - v1.y};
            const normal = {x: edge.y, y: -edge.x};
            const len = Math.hypot(normal.x, normal.y);
            normal.x /= len;
            normal.y /= len;
            const px = point.x - v1.x;
            const py = point.y - v1.y;
            const dist = px * normal.x + py * normal.y;
            if (dist < minDist) {
                minDist = dist;
                closestNormal = normal;
            }
        }
        return { normal: closestNormal, depth: -minDist };
    }
}

export { Collider, BoxCollider, CircleCollider, TriangleCollider }; 