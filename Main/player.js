import * as BMath from './bMath.js';
import * as Phys from './basePhysics.js';
import * as Graphics from './graphics.js';

const PLAYER_JUMP_V = -3*Phys.PHYSICS_SCALAR;
const PLAYER_WALLGRINDING_V = 0.5*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_V = -3*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_FORCE = 2*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_TIMER = 14*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_GRACE_DISTANCE = 2*Phys.PHYSICS_SCALAR; //How far the player has to be from a wall in order to walljump
const PLAYER_SQUEEZE_JUMP_V = BMath.Vector({x:10,y:-1});
const X_SPEED = 0.9*Phys.PHYSICS_SCALAR;

class Player extends Phys.Actor {
    constructor(x, y, w, h, room) {
        super(x, y, w, h, ["walls", "staticSpikes", "switchBlocks", "actors"], room, null, false);
        //this.test2 = this.test2.bind(this)

        // this.stateMachine = new StateMachine({
        //     "onGround": {
        //         transitions: ["inAir"],
        //     },
        //     "inAir": {
        //         transitions: ["onGround"],
        //     }
        // });

        this.onCollide = this.onCollide.bind(this);
        this.squish = this.squish.bind(this);
        this.facing = 1;
        this.carrying = null;
        this.jumpJustPressed = 0;
        this.xJustPressed = 0;
        this.coyoteTime = 0;
        this.xoyoteTime = 0;
        this.deathPos = BMath.Vector({x:0, y:0});
        this.wasOnGround = null;
        this.gyv = 0;
        this.movingPlatformCoyoteTime = 0;
        this.wallGrindingCoyoteTime = 0;
        this.justTouching = null;
        this.setUpBoxJump = false;
        this.cHeld = 0;
        this.xForce = 0;
        this.wallJumpTimer = 0;
        this.wasWallGrindingDirection = 0;
        this.misAligned = 0;
        this.squeezeJumpSetupCounter = 0;
        this.jumpedBeforeSqueezeJump = 0;
    }

    onCollide(physObj) {
        const playerCollideFunction = physObj.onPlayerCollide();
        if(physObj === this.carrying) return false;
        if(playerCollideFunction === "kill") {
            this.getRoom().killPlayer();
        } else if(playerCollideFunction.includes("spring")) {
            physObj.bounceObj(this);
        } else if(playerCollideFunction.includes("wall") || playerCollideFunction.includes("throwable")) {
            if(playerCollideFunction.includes("button") && physObj.pushed) {return false;}
            if(this.isOnTopOf(physObj)) {
                if(playerCollideFunction.includes("throwable")) {
                    if(playerCollideFunction.includes("sticky") && physObj.stuck) {
                        this.setYVelocity(0);
                        physObj.setYVelocity(0);
                        return true;
                    } else if(!physObj.isOnGround()){
                        // physObj.moveY(-1, physObj.onCollide);
                    }
                }
                this.setYVelocity(0);
                this.jumpJustPressed = 0;
                this.xJustPressed = 0;
            } else if(physObj.isOnTopOf(this) || (this.carrying && physObj.isOnTopOf(this.carrying))) {
                if (!playerCollideFunction.includes("throwable")) this.setYVelocity(physObj.getYVelocity() - 0.5);
                else {
                    // physObj.setYVelocity(this.getYVelocity());
                    const ret = physObj.moveY(-1, physObj.onCollide);
                    if(ret) {this.setYVelocity(-0.5);}
                    return ret;
                }
            } else if(playerCollideFunction.includes("wall") && (physObj.isLeftOf(this) || this.isLeftOf(physObj))) {
                this.setXVelocity(physObj.getXVelocity());
            } else if(playerCollideFunction.includes("throwable") && this.cHeld) {
                let direction = 0;
                if(physObj.isLeftOf(this)) {
                    direction = -1;
                } else if(this.isLeftOf(physObj)) {
                    direction = 1;
                }

                if(direction !== 0) {
                    return true;
                    // return physObj.moveX(direction, physObj.onCollide);
                }
            }
        }
        return true;
    }

    draw() {
        super.draw("#00ff00");
        Graphics.drawRectOnCanvas(new BMath.Rectangle(
            this.facing === -1 ? this.getX() : this.getX()+this.getWidth()-3,
            this.getY()+1,
            3, 3,
        ), "#000000");
    }

    onPlayerCollide() {
        return "";
    }

    squish(pushObj, againstObj, direction) {
        // throw new Error("function broken: doesn't check direction of physobjects");
        if(againstObj!==this && (super.squish(pushObj, againstObj, direction) || (pushObj === this.getCarrying() && direction.y > 0 && this.getY() + this.getHeight() > againstObj.getY()))) {
            this.getRoom().killPlayer();
            return true;
        }
    }

    respawnClone(level) {
        return new Player(this.spawn.x, this.spawn.y, this.origW, this.origH, level);
    }

    isBonkHead() {
        const normBonk = super.isBonkHead();
        if(this.carrying) {
            if(normBonk === this.carrying) {return false;}
            return normBonk || this.carrying.isBonkHead();
        } else {
            return normBonk;
        }
    }

    jump() {
        // console.log("ttsj", this.timeSinceSqueezeEnd);
        // console.log("jbsh", this.jumpedBeforeSqueezeJump);
        this.jumpedBeforeSqueezeJump = 32;
        this.setYVelocity(PLAYER_JUMP_V + Math.min(this.gyv/3, 0));
        if(this.timeSinceSqueezeEnd > 0) {
            this.squeezeJump(this.squeezeJumpSetupCounter);
        }
        this.coyoteTime = 0;
        this.movingPlatformCoyoteTime = 0;
        this.jumpJustPressed = 0;
        // audioCon.playSoundEffect(JUMP_SFX);
    }

    wallJump(direction) {
        // this.jump();
        // this.xForce = direction*-2;
        // this.xForceTimer = 14;

        // this.setYVelocity(Math.min(this.getYVelocity()+PLAYER_WALLJUMP_V,PLAYER_WALLJUMP_V));
        this.setYVelocity(PLAYER_WALLJUMP_V);
        this.setXVelocity(-direction*PLAYER_WALLJUMP_FORCE);
        // this.xForce = -direction*PLAYER_WALLJUMP_FORCE;
        this.wallJumpTimer = PLAYER_WALLJUMP_TIMER
    }

    isOverlap(physObj, offset) {
        const norm = super.isOverlap(physObj, offset);
        if(this.carrying) {
            return this.carrying !== physObj && (norm || this.carrying.isOverlap(physObj, offset));
        } else {
            return norm;
        }
    }

    pickUp(throwable) {
        this.carrying = throwable;
        this.carrying.startCarrying();

        // if(this.carrying.onPlayerCollide().includes("diamond")) {
            // audioCon.playSoundEffect(GEM_PICKUP_SFX, () => {audioCon.playSong(END_MUSIC); audioCon.queueSong(null)});
        // } else {
            // audioCon.playSoundEffect(PICKUP_SFX);
        // }

        this.xJustPressed = 0;
        this.xoyoteTime = 0;
    }

    setKeys(keys) {
        const onGround = this.isOnGround();
        if(keys["KeyR"] === 2) {this.getRoom().killPlayer();}
        let direction = 0;
        if(keys["ArrowRight"]) {
            // if(this.sprite.getRow() === 0 && onGround) this.sprite.setRow(1);
            direction = 1;
        } else if (keys["ArrowLeft"]) {
            // if(this.sprite.getRow() === 0 && onGround) this.sprite.setRow(1);
            direction = -1;
        }

        const vx = this.getXVelocity();
        if(direction) this.facing = direction;
        if(Math.abs(vx) < X_SPEED) {
            this.setXVelocity(direction*X_SPEED);
        } else {
            let add = 0.2 * Math.sign(direction*X_SPEED-vx);
            if(onGround) add *= 3;
            this.setXVelocity(this.getXVelocity()+add);
            if(Math.abs(this.getXVelocity()) < 0.1) this.setXVelocity(0);
        }

        // if(!onGround && this.sprite.getRow() !== 2) {this.sprite.setRow(2);}
        const zPressed = keys["KeyZ"] === 2;
        const xPressed = keys["KeyX"] === 2;
        this.cHeld = keys["KeyC"];
        //If z is pressed, jjp = 8, otherwise decr jjp if jjp > 0
        if(zPressed) {this.jumpJustPressed = 8;}
        else if(this.jumpJustPressed > 0) {this.jumpJustPressed -= 1;}
        if(!this.wallGrinding) {this.wallGrindingCoyoteTime -= 1;}
        const onWall = this.getRoom().isOnWallGrindable(this);
        if(!onWall || (!keys["ArrowRight"] && !keys["ArrowLeft"])) {this.wallGrinding = false;}
        else if(keys["ArrowRight"] && this.isLeftOf(onWall)) {this.wallGrinding = true;}
        else if(keys["ArrowLeft"] && onWall.isLeftOf(this)) {this.wallGrinding = true;}
        if(this.timeSinceSqueezeEnd > 0) {
            // alert();
            // console.log("ttse", this.timeSinceSqueezeEnd);
            this.timeSinceSqueezeEnd -= 1;
        }
        if(this.timeSinceSqueezeEnd === 0) this.squeezeJumpSetupCounter = 0;
        if(this.jumpedBeforeSqueezeJump > 0) {this.jumpedBeforeSqueezeJump -= 1;}
        if(onWall) {
            this.wallGrindingCoyoteTime = 4;
            this.wasWallGrindingDirection = this.isLeftOf(onWall) ? 1 : -1;
        }
        // if(onGround && onGround.onPlayerCollide() === "wall" && !this.wasOnGround) {this.getLevel().pushDustSprite(new GroundDustSprite(this.getX(), this.getY()-2, -this.facing.x, this.level))}
        if(!onGround) {
            if(this.coyoteTime > 0 && zPressed) {
                if(this.setUpBoxJump) {
                    this.boxJump();
                    this.setUpBoxJump = false;
                } else {
                    this.jump();
                }
            } else {
                const left = this.collideOffset(BMath.Vector({x:-PLAYER_WALLJUMP_GRACE_DISTANCE, y:0}));
                const right = this.collideOffset(BMath.Vector({x:PLAYER_WALLJUMP_GRACE_DISTANCE, y:0}));
                if(
                    this.jumpJustPressed &&
                    (this.wallGrindingCoyoteTime > 0 ||
                    (left && left.isWallGrindable() ||
                    (right && right.isWallGrindable()))))
                {
                    this.wallJump(this.wasWallGrindingDirection);
                    this.jumpJustPressed = 0;
                }
            }
        } else {
            this.coyoteTime = 8;
            if(this.jumpJustPressed > 0) {
                //Jump if jjp and on ground now
                if(onGround.onPlayerCollide().includes("throwable")) {
                    this.setUpBoxJump = true;
                }
                this.jump();
            } else {
                const newGYV = onGround.getYVelocity();
                if(newGYV < 0) {
                    this.gyv = newGYV;
                    this.movingPlatformCoyoteTime = 16;
                }
                if(this.movingPlatformCoyoteTime === 0) {
                    this.gyv = newGYV;
                }
            }
        }
        if(this.coyoteTime > 0) {this.coyoteTime -= 1; if(this.coyoteTime === 0) this.setUpBoxJump = false;}
        if(this.movingPlatformCoyoteTime > 0) {this.movingPlatformCoyoteTime -= 1;}
        if(this.carrying == null) {
            if(xPressed) {this.xJustPressed = 2;}
            else if(this.xJustPressed > 0) {this.xJustPressed -= 1;}
            const touching = this.getRoom().isTouchingThrowable(this);
            if(touching) {
                this.justTouching = touching;
                this.wasOnTopOfJustTouching = this.isOnTopOf(touching);
                this.xoyoteTime = 8;
            }
            if((this.xoyoteTime > 0 && xPressed) || (this.xJustPressed && touching)) {
                if(this.wasOnTopOfJustTouching && this.setUpBoxJump) {
                    this.boxJump();
                    this.setUpBoxJump = false;
                }
                if(this.isOnTopOf(this.justTouching)) {
                    this.setUpBoxJump = true;
                }
                this.pickUp(this.justTouching);
            }
            if(this.xoyoteTime > 0) {
                this.xoyoteTime -= 1;
                if(this.xoyoteTime === 0) {
                    this.justTouching = null;
                    this.setUpBoxJump = false;
                }
            }
        } else if(xPressed) {
            this.carrying.throw(this.facing);
            this.carrying = null;
            // this.getGame().startScreenShake();
            // audioCon.playSoundEffect(THROW_SFX);
        }
        this.wasOnGround = onGround;
    }

    update() {
        super.update();
        if (this.velocity.x > 0) {
            // this.getSprite().flip = true;
        }
        if (this.velocity.x < 0) {
            // this.getSprite().flip = false;
        }
        if(!this.isOnGround()) this.fall();
    }

    incrSqueezeJumpSetup(xOffset) {
        this.squeezeJumpSetupCounter += xOffset;
        this.setXVelocity(-Math.sign(xOffset)*Math.max(Math.abs(Math.sign(xOffset)+this.getXVelocity()), 2));
    }

    squeezeJump(counter) {
        if(counter > Graphics.TILE_SIZE*0.75) {
            this.setXVelocity(-PLAYER_SQUEEZE_JUMP_V.x*Math.sign(counter));
            this.setYVelocity(this.gyv+PLAYER_SQUEEZE_JUMP_V.y);
        }
        this.squeezeJumpSetupCounter = 0;
    }

    checkSqueezeJump() {
        if(!this.isOnGround()) {
            this.squeezeJump(this.squeezeJumpSetupCounter);
        }
        else {
            // alert();
            this.setXVelocity(-1*Math.sign(this.squeezeJumpSetupCounter));
            this.timeSinceSqueezeEnd = 16;
        }
    }

    incrX(dx) {
        const normResult = super.incrX(dx);
        if(this.misAligned !== 0 && this.carrying) {
            this.carrying.moveX(-dx, this.carrying.onCollide);
            if(this.getX() === this.carrying.getX()) {
                this.misAligned = 0;
                this.setXVelocity(0);
                return false;
            }
        }
        return normResult;
    }

    getCarrying() {
        return [this.carrying];
    }

    boxJump() {
        this.velocity.y = PLAYER_JUMP_V - 0.5*Phys.PHYSICS_SCALAR;
    }

    fall() {
        if(this.wallGrinding && this.velocity.y > 0) {
            this.setYVelocity(PLAYER_WALLGRINDING_V);
        } else if(this.wallJumpTimer > 0) {
            super.fall();
        } else {
            super.fall();
        }
    }

    setMisaligned(remainder) {
        this.misAligned = remainder;
        this.setXVelocity(Math.sign(remainder)*2);
    }
}

export {Player};