import * as BMath from './bMath.js';
import * as Graphics from './graphics.js';

const PHYSICS_SCALAR = Graphics.CANVAS_SCALAR*-0.5+3;
const MAXFALL = 6 * PHYSICS_SCALAR;
const PLAYER_GRAVITY_DOWN = 0.15*PHYSICS_SCALAR;
const PLAYER_GRAVITY_UP = 0.3*PHYSICS_SCALAR;
let DEBUG = true;
class Hitbox {
    constructor(x, y, width, height) {
        this.rect = new BMath.Rectangle(x, y, width, height);
    }

    toString() {
        return `${this.rect.toString()}`
    }

    getX() {return(this.rect.getX());}
    getY() {return(this.rect.getY());}
    getPos() {return(this.rect.pos);}
    getWidth() {return(this.rect.width);}
    getHeight() {return(this.rect.height);}
    setX(x) {this.rect.setX(x);}
    setY(y) {this.rect.setY(y);}
    incrX(dx) {this.rect.incrX(dx);}
    incrY(dy) {this.rect.incrY(dy);}

    isOverlap(hitbox) {
        return(hitbox !== this && this.rect.isOverlap(hitbox.rect));
    }
    isTouching(hitbox) {
        return(hitbox !== this && this.rect.isTouching(hitbox.rect));
    }
    isOnTopOf(hitbox) {return this.rect.isOnTopOf(hitbox.rect);}
    isLeftOf(hitbox) {return this.rect.isLeftOf(hitbox.rect);}
    draw(color) {Graphics.drawRectOnCanvas(this.rect, color);}

    cloneOffset(v) {
        return new Hitbox(this.getX()+v.x, this.getY()+v.y, this.rect.width, this.rect.height);
    }

    angleBetween(hitbox) {
        return this.rect.angleBetween(hitbox.rect);
    }
}

class PhysObj {
    constructor(x, y, w, h, collisionLayers, level, direction = null, wallGrindable = false) {
        if(direction) {
            const data = BMath.rotateRect(x, y, w, h, Graphics.TILE_SIZE, direction);
            this.hitbox = new Hitbox(data.newX, data.newY, data.newW, data.newH);
        }  else {
            this.hitbox = new Hitbox(x, y, w, h);
        }
        this.level = level;
        if(collisionLayers === "*") {
            collisionLayers = Object.keys(level.layers);
        }
        this.collisionLayers = collisionLayers;
        this.velocity = BMath.Vector({x:0, y:0});
        this.sprite = null;
        this.wallGrindable = wallGrindable;
    }

    getX() {return(this.hitbox.getX());}
    getY() {return(this.hitbox.getY());}
    getPos() {return(this.hitbox.getPos());}
    getWidth() {return(this.hitbox.getWidth());}
    getHeight() {return(this.hitbox.getHeight());}
    setHeight(h) {this.hitbox.rect.height = h;}
    getLevel() {return this.level;}
    setX(x) {this.hitbox.setX(x);}
    setY(y) {this.hitbox.setY(y);}
    incrX(dx) {this.hitbox.incrX(dx); return true;}
    incrY(dy) {this.setY(this.getY()+dy); return true;}
    setSprite(s) {this.sprite = s;}
    getSprite() {return this.sprite;}
    isWallGrindable() {return this.wallGrindable;}

    angleBetween(physObj) {return this.getHitbox().angleBetween(physObj.getHitbox());}
    onPlayerCollide() {throw new Error("Specify on player collide in physobj");}

    setXVelocity(vx) {
        this.velocity.x = vx;
    }
    setYVelocity(vy) {this.velocity.y = vy;}
    getXVelocity(vx) {return this.velocity.x;}

    getYVelocity() {return this.velocity.y;}
    setVelocity(v) {this.velocity.x = v.x; this.velocity.y = v.y;}

    update() {
        this.move(this.velocity.x, this.velocity.y);
        if(this.sprite && this.sprite.update) {this.sprite.update();}
    }

    move(x, y) {throw new Error("implement move in subclass PhysObj");}

    isOverlap(physObj, offset) {
        return this !== physObj && this.hitbox.cloneOffset(offset).isOverlap(physObj.getHitbox())
    }
    isTouching(hitbox) {return this.hitbox.isTouching(hitbox);}
    isOnTopOf(physObj) {return this.hitbox.isOnTopOf(physObj.getHitbox());}
    isUnder(physObj) {return physObj.getHitbox().isOnTopOf(this.hitbox);}
    isLeftOf(physObj) {return this.hitbox.isLeftOf(physObj.getHitbox());}
    isRightOf(physObj) {return physObj.getHitbox().isLeftOf(this.getHitbox());}
    getHitbox() {return(this.hitbox);}
    getLevel() {return this.level;}
    getGame() {return this.level.getGame();}
    draw(color) {
        if(this.sprite && !color) {
            this.sprite.draw(this.getX(), this.getY());
        } else {
            Graphics.drawRectOnCanvas(this.hitbox.rect, color);
        }
    }

    collideOffset(offset) {
        return this.getLevel().checkCollide(this, offset);
    }
}

class Actor extends PhysObj{
    constructor(x, y, w, h, collideLayers, level, direction, wallGrindable = false) {
        super(x, y, w, h, collideLayers, level, direction, wallGrindable);
        this.spawn = BMath.Vector({x:x, y:y});
        this.origW = w;
        this.origH = h;
    }

    respawnClone() {throw new Error("Implement respawn clone");}

    //Moves the actor by [amount] pixels and calls [onCollide] after collision with any object
    moveX(amount, onCollide) {
        let remainder = Math.round(amount);
        const direction = BMath.Vector({x:Math.sign(amount), y:0});
        if (remainder !== 0) {
            const carryingObjs = this.getCarrying();
            while(remainder !== 0) {
                let collideObj = this.collideOffset(direction);
                if(collideObj && !carryingObjs.includes(collideObj)) {
                    const shouldBreak = onCollide(collideObj, direction);
                    if(shouldBreak) {
                        return true;
                    }
                }
                if(!this.incrX(direction.x)) {
                    return false;
                }
                carryingObjs.forEach(carryingObj => {
                   if(carryingObj && carryingObj.getCarrying()[0] !== this) {carryingObj.moveX(direction.x, carryingObj.onCollide);}
                });
                remainder -= direction.x;
            }
        }
        return false;
    }

    moveY(amount, onCollide) {
        let remainder = Math.round(amount);
        const direction = BMath.Vector({y:Math.sign(amount), x:0});
        if (remainder !== 0) {
            const carryingObjs = this.getCarrying();
            while(remainder !== 0) {
                let collideObj = this.collideOffset(direction);
                if(collideObj && !carryingObjs.includes(collideObj)) {
                    const shouldBreak = onCollide(collideObj, direction);
                    if(shouldBreak) {
                        return true;
                    }
                }
                if(!this.incrY(direction.y)) {
                    return false;
                }
                // allRidingActors.forEach(actor => {
                //     actor.moveY(direction.Y, actor.onCollide);
                // });
                carryingObjs.forEach(carryingObj => {
                    if(carryingObj && carryingObj.getCarrying()[0] !== this) {
                        carryingObj.moveY(direction.y, carryingObj.onCollide);
                    }
                });
                remainder -= direction.y;
            }
        }
        return false;
    }

    isOnGround() {
        return(this.getLevel().isOnGround(this));
    }

    isBonkHead() {
        return(this.getLevel().isBonkHead(this));
    }

    isRiding(solid) {
        return(this.getHitbox().isOnTopOf(solid.getHitbox()));
    }

    bonkHead(physObj) {
        this.setYVelocity(Math.max(physObj.getYVelocity() - 0.5, this.getYVelocity()));
    }

    onCollide(physObj) {throw new Error("implement method onCollide in subclass Actor");}
    fall() {
        this.setYVelocity(Math.min(MAXFALL, this.velocity.y + (this.velocity.y > 0 ? PLAYER_GRAVITY_UP : PLAYER_GRAVITY_DOWN)));
    }

    squish(pushObj, againstObj, direction) {
        const pushObjNewHb = pushObj.getHitbox().cloneOffset(direction.scalar(-1));
        const hb = this.getHitbox();
        return ((hb.isOnTopOf(pushObjNewHb) && againstObj.isOnTopOf(this)) ||
            (hb.isLeftOf(pushObjNewHb) && againstObj.isLeftOf(this)) ||
            (pushObjNewHb.isLeftOf(hb) && this.isLeftOf(againstObj)) ||
            (pushObjNewHb.isOnTopOf(hb) && this.isOnTopOf(againstObj)));

        // throw new Error("implement method squish in subclass actor");
    }
    getCarrying() {return [];}
    move(x,y) {
        const mX = this.moveX(x, this.onCollide);
        const mY = this.moveY(y, this.onCollide);
        if(mX) return mX;
        else if(mY) return mY;
        else return false;
    }
}

class Solid extends PhysObj {
    constructor(x, y, w, h, collideLayers, level, direction, wallGrindable = false) {
        super(x, y, w, h, collideLayers, level, direction, wallGrindable);
    }

    move(moveX, moveY) {
        let remainderX = Math.round(moveX);
        let remainderY = Math.round(moveY);
        if (remainderX !== 0 || remainderY !== 0) {
            const ridingActors = super.getLevel().getAllRidingActors(this);
            const allActors = super.getLevel().getActors();
            // alert();
            if(remainderX !== 0) {
                const directionX = Math.sign(remainderX);
                while(remainderX !== 0) {
                    this.incrX(directionX);
                    let shouldBreak = false;
                    allActors.some(actor => {
                        if (ridingActors.includes(actor)) {
                            actor.moveX(directionX, actor.onCollide);
                        } else if (this.getHitbox().isOverlap(actor.getHitbox())) {
                            if(actor.moveX(directionX, (physObj) => {
                                return actor.squish(this, physObj, BMath.Vector({x:directionX, y:0}));
                            })) {shouldBreak = true; return;}
                        }
                    });
                    if(shouldBreak) break;
                    remainderX -= directionX;
                }
            }
            if (remainderY !== 0) {
                const directionY = Math.sign(remainderY);
                while(remainderY !== 0) {
                    super.incrY(directionY);
                    let shouldBreak = false;
                    allActors.some(actor => {
                        if (ridingActors.includes(actor)) {
                            actor.moveY(directionY, actor.onCollide);
                        } else if (this.getHitbox().isOverlap(actor.getHitbox())) {
                            if(actor.moveY(directionY, (physObj) => {
                                return actor.squish(this, physObj, BMath.Vector({x:0, y:directionY}));
                            })) {
                                shouldBreak = true; return;
                            }
                        }
                    });
                    if(shouldBreak) {super.incrY(-directionY); break;}
                    remainderY -= directionY;
                }
            }
        }
    }

    onPlayerCollide() {
        return "wall";
    }
}

class Layer {
    constructor(allStatic) {
        this.objs = [];
        this.allStatic = allStatic;
    }

    sortObjs() {
        const physObjCompare = (a, b) => {
            return a.getX()+a.getWidth()-(b.getX()+b.getWidth());
        };
        this.objs.sort(physObjCompare);
    }

    pushObj(o) {
        this.objs.push(o);
    }

    forEachSlicedObjs(lowTarget, highTarget, callBack) {
        if(this.objs.length === 0) return this.objs;
        if(this.allStatic) {
            const lowInd = this.binaryAboveX(lowTarget);
            const len = this.objs.length;
            for(let i = lowInd; i<len; ++i) {
                const curObj = this.objs[i];
                if(curObj.getX() < highTarget) {
                    callBack(curObj);
                } else {
                    break;
                }
            }
        } else {
            this.objs.forEach(callBack);
        }
        // return this.allStatic ? this.objs.slice(this.binaryAboveX(lowInd), this.binaryBelowX(highInd)) : this.objs;
    }

    drawAll() {
        const leftWidth = Math.max(this.objs[0] ? this.objs[0].getWidth() : 0, Graphics.TILE_SIZE);
        this.forEachSlicedObjs(
            -Graphics.cameraOffset.x-leftWidth,
            -Graphics.cameraOffset.x+Graphics.cameraSize.x,
            o => {
                o.draw();
            }
        );
    }

    update() {
        if(this.allStatic) {
            // console.warn("Warning: updating static layer");
            // console.trace();
            // throw new Error("Trying to update layer in static layer");
        } else {
            this.objs.forEach(o => {
                o.update();
            });
        }
    }

    checkCollide(physObj, offset) {
        let ret = null;
        this.forEachSlicedObjs(
            physObj.getX() + offset.x,
            physObj.getX() + physObj.getWidth() + offset.x,
            checkObj => {
                if (checkObj !== physObj && physObj.isOverlap(checkObj, offset)) {
                    ret = checkObj;
                    return;
                }
            }
        );
        if(physObj.onPlayerCollide() === "") {
            this.offset = offset;
        }
        return ret;
    }

    binaryAboveX(targetX) {
        let low = 0, high = this.objs.length; // numElems is the size of the array i.e arr.size()
        while (low+1 !== high) {
            const mid = Math.floor((low + high) / 2); // Or a fancy way to avoid int overflow
            const mO = this.objs[mid];
            if (mO.getX()+mO.getWidth() > targetX) {
                if(mid-1 < 0 || this.objs[mid-1].getX()+this.objs[mid-1].getWidth() <= targetX) return mid;
                high = mid;
            }
            else {
                low = mid;
            }
        }
        if(low === 0) {return 0;}
        else return this.objs.length;
    }
}

function toggleDebug() {
    console.log("toggle");
    DEBUG = !DEBUG;
}

export {
    PHYSICS_SCALAR, MAXFALL, PLAYER_GRAVITY_UP, PLAYER_GRAVITY_DOWN, DEBUG, toggleDebug,
    Hitbox, PhysObj, Actor, Solid, Layer
};