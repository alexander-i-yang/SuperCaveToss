import * as BMath from './bMath.js';
import * as Phys from './basePhysics.js';
import * as Graphics from './graphics.js';

const PLAYER_JUMP_V = -3*Phys.PHYSICS_SCALAR;
const PLAYER_WALLGRINDING_V = 0.5*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_V = -3*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_FORCE = 3*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_TIMER = 14*Phys.PHYSICS_SCALAR;
const PLAYER_WALLJUMP_GRACE_DISTANCE = 2*Phys.PHYSICS_SCALAR; //How far the player has to be from a wall in order to walljump
const PLAYER_SQUEEZE_JUMP_V = BMath.Vector({x:10,y:-1});
const X_SPEED = 1.6*Phys.PHYSICS_SCALAR;
const RUNNING_SPEED = 3*Phys.PHYSICS_SCALAR;
const COYOTE_TIME = 8;
const JUMP_JUST_PRESSED_FRAMES = 12;
const CROUCH_HEIGHT = Graphics.TILE_SIZE;

class Player extends Phys.Actor {
    constructor(x, y, w, h, level) {
        super(x, y, w, h, ["walls", "staticSpikes", "switchBlocks", "throwables"], level, null, false);
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
    }

    onCollide(physObj) {
        const playerCollideFunction = physObj.onPlayerCollide();
        if(physObj === this.carrying) return false;
        if(playerCollideFunction === "kill") {
            this.getLevel().killPlayer();
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
                this.xJustPressed = 0;
            } else if(physObj.isOnTopOf(this) || (this.carrying && physObj.isOnTopOf(this.carrying))) {
                // if(Phys.DEBUG) alert("bonking head");
                if (!playerCollideFunction.includes("throwable")) {
                    this.bonkHead(physObj);
                } else {
                    // physObj.setYVelocity(this.getYVelocity());
                    const ret = physObj.moveY(-1, physObj.onCollide);
                    if(ret) {
                        this.bonkHead(physObj);
                    } else {
                        physObj.setYVelocity(this.getYVelocity()+2);
                        return false;
                    }
                    // if(this.getYVelocity() > 1) {alert("pbonk");}
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
                    // return physObj.moveX(direction, physObj.onCollide);
                    return true;
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
        let kill = true;
        if(this.getHeight() > CROUCH_HEIGHT) {
            kill = this.crouch();
            this.draw();
            this.forcedCrouch = true;
        }
        // alert(direction);
        if(kill && pushObj.isOnTopOf(this)) {this.getLevel().killPlayer(); return true;}
        return true;
        // throw new Error("function broken: doesn't check direction of physobjects");
        // if(againstObj!==this && (super.squish(pushObj, againstObj, direction) || (pushObj === this.getCarrying() && direction.y > 0 && this.getY() + this.getHeight() > againstObj.getY()))) {
        //     this.getRoom().killPlayer();
        //     return true;
        // }
    }

    respawnClone() {
        return new Player(this.spawn.x, this.spawn.y, this.origW, this.origH, this.level);
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
        this.setYVelocity(PLAYER_JUMP_V + Math.min(this.gyv/3, 0));
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

    crouch() {
        const h = this.getHeight();
        // alert();
        if(h > CROUCH_HEIGHT) {
            this.setHeight(h-1);
            const ret = this.moveY(1, this.onCollide);
            return ret;
        }
        return true;
    }

    setKeys(keys) {
        const onGround = this.isOnGround();
        if(keys["KeyR"] === 2) {this.getLevel().killPlayer();}
        const h = this.getHeight();
        if(keys["ArrowDown"] && onGround) {
            this.crouch();
        } else if(h < Graphics.TILE_SIZE*1.5 && (this.getYVelocity() >= 0 || onGround || !keys["ArrowDown"])) {
            const m = this.moveY(-1, this.onCollide);
            // alert();
            if(!m && !this.forcedCrouch) {
                // alert();
                // this.setYVelocity(0.1);
                this.setHeight(this.getHeight()+1);
            } else {
                // this.moveY(1, this.onCollide);
                // this.setYVelocity(0);
                // alert();
                if(!m) {this.forcedCrouch = false;}
            }
        }

        let direction = 0;
        if(keys["ArrowRight"]) {
            // if(this.sprite.getRow() === 0 && onGround) this.sprite.setRow(1);
            direction = 1;
        } else if (keys["ArrowLeft"]) {
            // if(this.sprite.getRow() === 0 && onGround) this.sprite.setRow(1);
            direction = -1;
        }
        this.cHeld = keys["KeyC"];
        const vx = this.getXVelocity();
        if(direction) this.facing = direction;
        let applyXSpeed = this.isCrouching() ? 1*Phys.PHYSICS_SCALAR : X_SPEED;
        if(Math.abs(vx) < applyXSpeed && direction === Math.sign(vx)) {
            // if(vx !== 0 && !this.isOnGround()) {alert();}
            this.setXVelocity(direction*applyXSpeed);
        } else {
            // let add = 0.2 * Math.sign(direction*applyXSpeed-vx);
            // if(onGround) add *= 3;
            // this.setXVelocity(this.getXVelocity()+add);
            // if(Math.abs(this.getXVelocity()) < 0.1) this.setXVelocity(0);
            let add = 0.8 * Math.sign(direction*applyXSpeed-vx);
            if(onGround) add *= 1.2;
            this.setXVelocity(vx+add);
            if(Math.sign(vx) !== 0 && Math.sign(this.getXVelocity()) !== Math.sign(vx)) {this.setXVelocity(0);}
        }
        // let add = 0.4 * Math.sign(direction*applyXSpeed-vx);
        // if(onGround) add *= 2;
        // this.setXVelocity(this.getXVelocity()+add);
        // if(Math.abs(this.getXVelocity()) < 0.5 && direction === 0) this.setXVelocity(0);
         // if(!onGround && this.sprite.getRow() !== 2) {this.sprite.setRow(2);}
        const zPressed = keys["KeyZ"] === 2;
        const xPressed = keys["KeyX"] === 2;
        //If z is pressed, jjp = 8, otherwise decr jjp if jjp > 0
        if(zPressed) {this.jumpJustPressed = JUMP_JUST_PRESSED_FRAMES;}
        else if(this.jumpJustPressed > 0) {this.jumpJustPressed -= 1;}
        if(!this.wallGrinding) {this.wallGrindingCoyoteTime -= 1;}
        const onWall = this.getLevel().isOnWallGrindable(this);
        if(!onWall || (!keys["ArrowRight"] && !keys["ArrowLeft"])) {this.wallGrinding = false;}
        else if(keys["ArrowRight"] && this.isLeftOf(onWall)) {this.wallGrinding = true;}
        else if(keys["ArrowLeft"] && onWall.isLeftOf(this)) {this.wallGrinding = true;}
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
            this.coyoteTime = COYOTE_TIME;
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
            const touching = this.getLevel().isTouchingThrowable(this);
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
            this.carrying.throw(this.facing, this.getXVelocity());
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

    isCrouching() {return this.getHeight() < Graphics.TILE_SIZE*1.5;}

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

    setYVelocity(y) {
        // console.log("vy:", y);
        // if(y > 1) {console.trace();}
        super.setYVelocity(y);
    }
}

export {Player};