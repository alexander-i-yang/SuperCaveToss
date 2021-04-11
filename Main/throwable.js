import * as BMath from './bMath.js';
import * as Phys from './basePhysics.js';
import * as Graphics from './graphics.js';
import {StateMachine} from './stateMachine.js';

const THROW_ANGLE = Math.PI/6;
const THROW_STRENGTH = 3;
const THROW_VELOCITY = BMath.Vector({x: Math.cos(THROW_ANGLE), y: -Math.sin(THROW_ANGLE)}).scalar(Phys.PHYSICS_SCALAR*THROW_STRENGTH);
const THROW_DISTANCE = 60*Phys.PHYSICS_SCALAR;
const PICKUP_POS = BMath.Vector({x:0, y:-2});

class Throwable extends Phys.Actor {
    constructor(x, y, w, h, level) {
        super(x, y, w, h, ["walls", "player", "throwables", "switchBlocks"], level, null, true);
        this.throwVelocity = THROW_VELOCITY;
        this.onCollide = this.onCollide.bind(this);
        this.squish = this.squish.bind(this);
        this.throwX = 0;
        this.idleUpdate = this.idleUpdate.bind(this);
        this.incrPickupFrames = this.incrPickupFrames.bind(this);
        this.endPickup = this.endPickup.bind(this);
        // this.startFalling = this.startFalling.bind(this);
        this.startCarrying = this.startCarrying.bind(this);
        this.wasOnGround = null;
        this.stateMachine = new StateMachine({
            "throwing": {
                onStart: () => {
                    // console.log("start throwing");
                },
                onUpdate: this.idleUpdate,
                transitions: ["falling", "picking", "idle"],
            },
            "falling": {
                maxTimer: 8,
                onStart: () => {},
                onUpdate: this.idleUpdate,
                timeOutTransition: "idle",
                transitions: ["idle", "picking"],
            },
            "idle": {
                onStart: (params) => {
                    // console.log("idle start", params);
                    if(params) {
                        if(params.direction) {
                            this.setXVelocity(params.direction);
                        }
                    }
                },
                onUpdate: this.idleUpdate,
                transitions: ["picking"],
            },
            "picking": {
                maxTimer: 12,
                onStart: () => {
                    this.prevCollisionLayers = this.collisionLayers;
                    this.collisionLayers = ["walls"];
                },
                onUpdate: this.incrPickupFrames,
                timeOutTransition: "picked",
                transitions: ["picked", "throwing"],
            },
            "picked": {
                onStart: this.endPickup,
                onUpdate: () => {
                    const player = this.getLevel().getPlayer();
                    const targetPos = this.getTargetPos(player);
                    // console.log(player);
                    const prevCL = this.collisionLayers;
                    this.collisionLayers = [];
                    if(this.getX() !== targetPos.x || this.getY() !== targetPos.y) {
                        this.moveX(Math.sign(targetPos.x-this.getX()), this.onCollide);
                        this.moveY(Math.sign(targetPos.y-this.getY()), this.onCollide);
                    }
                    this.collisionLayers = prevCL;
                },
                transitions: ["throwing"],
            }
        }, "idle");
    }

    startCarrying() {
        this.stateMachine.transitionTo("picking");
        this.gyv = null;
    }

    onPlayerCollide() {
        return "wall throwable";
    }

    squish(pushObj, againstObj, direction) {
        if(super.squish(pushObj, againstObj, direction)) {
            this.getLevel().killPlayer(this.getX(), this.getY());
            return true;
        }
    }

    respawnClone() {
        return new Throwable(this.spawn.x, this.spawn.y, this.origW, this.origH, this.getLevel());
    }

    draw() {super.draw(this.stateMachine.curStateName.includes("pick") ? "#fcf003" : "#eb9c09");}

    endPickup() {
        // const player = this.getRoom().getPlayer();
        // const remainder = this.getX() - player.getX();
        // if(remainder !== 0) {
        //     player.setMisaligned(remainder);
        //     // this.setX(player.getX());
        // }
        // this.setY(player.getY()-this.getHeight()-2);
        // this.setX(player.getX());
    }

    throw(direction, throwerXV) {
        let throwV = direction === -1 ? this.throwVelocity.scalarX(-1) : this.throwVelocity;
        // if(this.getSprite().setRow) this.getSprite().setRow(0);
        this.setVelocity(throwV.addPoint({x:throwerXV,y:0}));
        this.throwX = this.getX();
        this.collisionLayers = this.prevCollisionLayers;
        this.stateMachine.transitionTo("throwing");
        this.throwDirection = this.getXVelocity();
    }

    // isOverlap(physObj, offset) {
    //     const norm = super.isOverlap(physObj, offset);
    //     if(this.beingCarried) {
    //         return physObj !== super.getLevel().getPlayer() && norm;
    //     } else {
    //         return norm;
    //     }
    // }

    onCollide(physObj, direction) {
        console.log(physObj);
        const playerCollideFunction = physObj.onPlayerCollide();
        if(this.stateMachine.curStateName === "picked") {
            return this.getLevel().getPlayer().onCollide(physObj);
        }
        if(playerCollideFunction.includes("spring")) {
            physObj.bounceObj(this);
            if(this.stateMachine.curStateName === "falling") {
                this.stateMachine.transitionTo("idle", {direction: Math.sign(this.velocity.x)});
            }
        }
        if(playerCollideFunction.includes("throwable") && physObj !== this) {
            if(direction.y < 0) {
                if(!physObj.getCarrying().includes(this)) {
                    const ret = physObj.move(direction.x, direction.y);
                    if(ret) return ret;
                }
            }
        }
        if(playerCollideFunction.includes("wall")) {
            if(playerCollideFunction.includes("button")) {
                const direction = physObj.direction;
                if(direction === BMath.VectorLeft && this.isLeftOf(physObj)) {
                    physObj.push();
                } else if(direction === BMath.VectorUp && this.isOnTopOf(physObj)) {
                    physObj.push();
                } else if(direction === BMath.VectorRight && this.isRightOf(physObj)) {
                    physObj.push();
                }
                if(physObj.pushed) {return false;}
            }
            if(physObj.isOnTopOf(this)) {
                //Bonk head
                if(this.stateMachine.curStateName !== "throwing") {
                    this.bonkHead(physObj);
                }
            } else if(this.isOnTopOf(physObj)) {
                if(playerCollideFunction.includes("ice")) {
                    if(this.stateMachine.curStateName === "falling" || this.stateMachine.curStateName === "throwing")
                        this.stateMachine.transitionTo("idle", {direction: Math.sqrt(this.getXVelocity()**2+this.getYVelocity())});
                    this.setYVelocity(physObj.getYVelocity());
                } else {
                    this.setXVelocity(0);
                }
                //Land on ground
                // this.setYVelocity(physObj.getYVelocity());
                // if(!this.isOnIce() && this.throwHeight > this.getHeight()+24) {this.setXVelocity(physObj.getXVelocity());}
            } else if((this.isLeftOf(physObj) || this.isRightOf(physObj)) && this.velocity.x !== 0) {
                if(!this.stateMachine.curStateName.includes("pick")) {
                    this.velocity.y -= 0.5;
                    this.setXVelocity(0);
                }
                return true;
                // if(playerCollideFunction === "wall") {this.getRoom().pushDustSprite(new GroundDustSprite(this.getX(), this.getY()-3, 0, this.level, this.velocity.x < 0 ? VectorRight : VectorLeft))}
            }
        } else if(playerCollideFunction === "") {
            const diff = physObj.getY()+physObj.getHeight() - this.getY();
            if(diff > 0 && this.getY() > physObj.getY()+physObj.getHeight()/2) {
                const ret = physObj.moveY(-1, physObj.onCollide);
                if(ret) {
                    // alert();
                    this.incrY(diff);
                    this.setYVelocity(-0.5);
                    return false;
                }
                this.draw();
                return ret;
            }
        }
        return true;
    }

    getCarrying() {
        return this.getLevel().getAllRidingActors(this);
    }

    incrPickupFrames() {
        const player = super.getLevel().getPlayer();
        const tx = this.getX();
        const ty = this.getY();
        //Target pos
        const targetPos = this.getTargetPos(player);
        //Move closer to target pos
        const maxT = this.stateMachine.getCurState().maxTimer;
        const curT = maxT-this.stateMachine.getCurState().curTimer+1;
        let xOffset = Math.floor((targetPos.x-tx)*curT/maxT);
        let yOffset = Math.floor((targetPos.y-ty)*curT/maxT);
        //Check to make sure this didn't tunnel through anything
        let collideObj = super.getLevel().checkCollide(this, BMath.VectorZero);
        // if(collideObj) {
        //     const vx1 = collideObj.getX();
        //     const vx2 = vx1+collideObj.getWidth();
        //     if(tx < vx2 && tx > vx1) {
        //         this.setX(vx2);
        //     } else if(tx+this.getWidth() > vx1 && tx+this.getWidth() > vx1) {
        //         this.setX(vx1-this.getWidth());
        //     }
        // }

        this.moveY(yOffset, physObj => {
            const ret = this.onCollide(physObj, yOffset);
            if(this.onCollide(physObj, yOffset) && yOffset < 0 && player.getY() > this.getY()) return player.moveY(1, (physObj) => player.squish(this, physObj, 1));
            else return ret;
        });
        this.moveX(xOffset, physObj => {
            return player.moveX(-Math.sign(xOffset), player.onCollide);
        });

        //If there's something above the object and xOffset != 0 ()
        // this.moveY(yOffset, (physObj) => {
        //     if(physObj === player) return false;
        //     const onC = this.onCollide(physObj);
        //     // alert("my");
        //     if(onC && yOffset < 0) {
        //         if(player.collideOffset(BMath.Vector({x:0, y:1})) != null) {
        //             player.incrSqueezeJumpSetup(player.facing);
        //             return player.moveX(player.facing, player.onCollide);
        //         } else {
        //             player.moveY(1, player.onCollide);
        //         }
        //     }
        //     return onC;
        // });
        // //foo
        // this.moveX(xOffset, (physObj) => {
        //     if(this.onCollide(physObj)) {
        //         // const prevCL = player.collisionLayers;
        //         // player.collisionLayers = ["walls"];
        //         player.incrSqueezeJumpSetup(xOffset);
        //         // player.collisionLayers = prevCL;
        //         // this.moveX(Math.sign(xOffset), this.onCollide);
        //         return player.moveX(-xOffset, player.onCollide);
        //     }
        // });

        // collideObj = super.getRoom().checkCollide(this, BMath.VectorZero);
        // if(collideObj) {
        //     const vx1 = collideObj.getX();
        //     const vx2 = vx1+collideObj.getWidth();
        //     if(tx < vx2 && tx > vx1) {
        //         this.setX(vx2);
        //     } else if(tx+this.getWidth() > vx1 && tx+this.getWidth() > vx1) {
        //         this.setX(vx1-this.getWidth());
        //     }
        // }
        // //Check to make sure there's nothing in the way in the y direction
        // collideObj = super.getRoom().checkCollide(this, BMath.Vector({x:0, y:yOffset}));
        // if(collideObj) {
        //     //If there is something in the way, move the player and the box down
        //     console.log(collideObj, this.getX(), yOffset);
        //     alert();
        //     player.moveY(-1*yOffset, (againstObj) => {player.squish(this, againstObj, BMath.VectorDown)});
        //     yOffset = 0;
        // }

        // this.incrX(xOffset, this.onCollide);
        // this.incrY(yOffset, this.onCollide);
    }

    setY(dy) {
        super.setY(dy);
        // console.trace();
    }

    update() {
        this.stateMachine.update();
    }

    idleUpdate() {
        super.update();
        const onGround = this.isOnGround();
        if (!onGround) {
            if(this.gyv != null) {
                this.setYVelocity(0);
                this.gyv = null;
            }
            this.fall();
            if (this.stateMachine.curStateName === "throwing" && Math.abs(this.getX() - this.throwX) > THROW_DISTANCE) {
                this.stateMachine.transitionTo("falling", {direction: this.velocity.x})
            }
            if(this.stateMachine.curStateName === "falling") {
                // this.setXVelocity(0);
                if(this.getXVelocity() !== 0) {
                    const vx = this.getXVelocity();
                    const origSign = Math.sign(vx);
                    this.setXVelocity(vx-Math.sign(this.throwDirection)*0.5);
                    if(Math.sign(this.getXVelocity()) !== origSign || Math.abs(this.getXVelocity()) < 0.1) {this.setXVelocity(0);}
                }
            }
        } else {
            // if (!this.isOnIce()) {
            //     this.velocity.x = 0;
            //     this.touchedIce = false;
            // } else {
            //     this.touchedIce = true;
            // }
            this.gyv = onGround.getYVelocity();
            // console.log(this.gyv);
            // if(this.gyv > 1) {console.log("gyv:", this.gyv, onGround); alert();}
            // if(this.stateMachine.curStateName === "throwing") {this.stateMachine.transitionTo("idle");}
        }
        if (this.getY() > Graphics.CANVAS_SIZE[1]) {
            this.getLevel().killPlayer(this.getX(), this.getY());
        }
        this.wasOnGround = onGround;
        // if (this.getSprite().update) this.getSprite().update();
    }

    getTargetPos(player) {
        const px = player.getX()+PICKUP_POS.x;
        const py = player.getY()-this.getHeight()+(player.isCrouching() ? 0 : PICKUP_POS.y);
        return BMath.Vector({x:px, y:py});
    }

    fall() {
        super.fall();
        // if(this.getYVelocity() > 1) alert(this.getYVelocity());
    }

    setYVelocity(y) {
        // console.log("vy:", y);
        // if(y > 1) {console.trace();}
        super.setYVelocity(y);
    }
}

export {Throwable};