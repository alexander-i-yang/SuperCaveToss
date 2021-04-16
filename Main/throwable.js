import * as BMath from './bMath.js';
import * as Phys from './basePhysics.js';
import * as Graphics from './graphics.js';
import {StateMachine} from './stateMachine.js';

const THROW_ANGLE = Math.PI/10;
const THROW_STRENGTH = 5;
const THROW_VELOCITY = BMath.Vector({x: Math.cos(THROW_ANGLE), y: -Math.sin(THROW_ANGLE)}).scalar(Phys.PHYSICS_SCALAR*THROW_STRENGTH);
const THROW_DISTANCE = 60*Phys.PHYSICS_SCALAR;
const PICKUP_POS = BMath.Vector({x:0, y:-2});

class Throwable extends Phys.Actor {
    constructor(x, y, w, h, level) {
        super(x, y, w, h, ["walls", "player", "throwables", "springs"], level, null, true);
        this.throwVelocity = THROW_VELOCITY;
        this.onCollide = this.onCollide.bind(this);
        this.squish = this.squish.bind(this);
        this.throwX = 0;
        this.idleUpdate = this.idleUpdate.bind(this);
        this.incrPickupFrames = this.incrPickupFrames.bind(this);
        this.endPickup = this.endPickup.bind(this);
        this.carriedBy = null;
        this.startCarrying = this.startCarrying.bind(this);
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
                maxTimer: 5,
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
                    const targetPos = this.getTargetPos(this.carriedBy);
                    // console.log(player);
                    const prevCL = this.collisionLayers;
                    this.collisionLayers = [];
                    if(this.getX() !== targetPos.x || this.getY() !== targetPos.y) {
                        this.moveX(Math.sign(targetPos.x-this.getX()), this.onCollide);
                        this.moveY(Math.sign(targetPos.y-this.getY()), this.onCollide);
                    }
                    this.collisionLayers = prevCL;
                },
                transitions: ["throwing", "picking"],
            }
        }, "idle");
    }

    startCarrying(carriedBy) {
        this.stateMachine.transitionTo("picking");
        this.gyv = null;
        this.carriedBy = carriedBy;
        carriedBy.setCarrying(this);
        if(carriedBy.onPlayerCollide().includes("booster")) {
            this.setXVelocity(carriedBy.getXVelocity());
            this.setYVelocity(carriedBy.getYVelocity());
        }
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

    draw() {
        super.draw(this.stateMachine.curStateName.includes("pick") ? "#fcf003" : "#eb9c09");
        Graphics.drawRectOnCanvas(new BMath.Rectangle(this.getX(), this.getY()+this.getHeight()-1, this.getWidth(), 1), "#fcf003");
    }

    endPickup() {
        this.collisionLayers = this.prevCollisionLayers;
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
        this.setVelocity(throwV.addPoint({x:throwerXV/2,y:0}));

        const tpos = this.getTargetPos(this.carriedBy);
        this.setX(tpos.x); this.setY(tpos.y);
        let collideObj = super.getLevel().checkCollide(this, BMath.VectorZero);
        if(collideObj) {
            const yOffset = collideObj.getY()+collideObj.getHeight()-this.getY();
            this.carriedBy.moveY(yOffset, physObj => this.carriedBy.squish(this, physObj));
            this.setY(this.getY()+yOffset);
        }
        this.throwX = this.getX();
        this.collisionLayers = this.prevCollisionLayers;
        this.stateMachine.transitionTo("throwing");
    }

    // isOverlap(physObj, offset) {
    //     const norm = super.isOverlap(physObj, offset);
    //     if(this.beingCarried) {
    //         return physObj !== super.getLevel().getPlayer() && norm;
    //     } else {
    //         return norm;
    //     }
    // }

    canBePushed(pusher, direction) {
        if (pusher.onPlayerCollide() === "" && direction.y > 0) return false;
        if (pusher.onPlayerCollide().includes("throwable") && direction.y > 0) return false;
        return true;
    }

    onCollide(physObj, direction) {
        const playerCollideFunction = physObj.onPlayerCollide();
        if(this.stateMachine.curStateName === "picked") {
            return this.carriedBy.onCollide(physObj, direction);
        }
        if(!this.stateMachine.curStateName.includes("pick") && playerCollideFunction.includes("booster")) {
            this.startCarrying(physObj);
            return false;
        }
        if(playerCollideFunction.includes("spring")) {
            physObj.bounceObj(this);
            if(this.stateMachine.curStateName === "falling") {
                this.stateMachine.transitionTo("idle", {direction: Math.sign(this.velocity.x)});
            }
        }
        if (playerCollideFunction.includes("throwable")) {
            if(direction.y > 0) {this.setYVelocity(0); return true;}
            else if(direction.y < 0) {this.bonkHead(); return true;}
            return true;
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
            if(direction.y < 0) {
                //Bonk head
                if(this.stateMachine.curStateName !== "throwing") {
                    this.bonkHead(physObj);
                }
                return true;
            } else if(direction.y > 0) {
                if(playerCollideFunction.includes("ice")) {
                    if(this.stateMachine.curStateName === "falling" || this.stateMachine.curStateName === "throwing")
                        this.stateMachine.transitionTo("idle", {direction: Math.sqrt(this.getXVelocity()**2+this.getYVelocity())});
                } else {
                    this.setXVelocity(0);
                }
                this.setYVelocity(0);
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
            // const diff = physObj.getY()+physObj.getHeight() - this.getY();
            // if(this.isLeftOf(physObj) || physObj.isLeftOf(this)) {
            //     this.setXVelocity(physObj.getXVelocity());
            //     this.setYVelocity(physObj.getYVelocity());
            // }
            // // alert();
            // if(diff > 0 && this.getY() > physObj.getY()+physObj.getHeight()/2) {
            //     const ret = physObj.moveY(-1, physObj.onCollide);
            //     if(ret) {
            //         // alert();
            //         this.incrY(diff);
            //         this.setYVelocity(-0.5);
            //         return false;
            //     }
            //     this.draw();
            //     return ret;
            // }
            if(direction.y > 0) this.setYVelocity(0);
            else if(direction.y < 0) this.bonkHead();
            return true;
        }
        return true;
    }

    getCarryingActors() {
        return this.getLevel().getAllRidingActors(this);
    }

    incrPickupFrames() {
        const tx = this.getX();
        const ty = this.getY();
        //Target pos
        const targetPos = this.getTargetPos(this.carriedBy);
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
            const ret = this.onCollide(physObj);
            if(this.onCollide(physObj) && yOffset < 0 && this.carriedBy.getY() > this.getY()) {
                if (this.carriedBy.moveY) return this.carriedBy.moveY(1, (physObj) => this.carriedBy.squish(this, physObj, 1));
                return false;
            } else return ret;
        });
        this.moveX(xOffset, physObj => {
            if(this.carriedBy.moveX) return this.carriedBy.moveX(-Math.sign(xOffset), this.carriedBy.onCollide);
            return false;
        });
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
            if(this.stateMachine.curStateName === "falling" || this.stateMachine.curStateName === "throwing") {
                // this.setXVelocity(0);
                const vx = this.getXVelocity();
                this.setXVelocity(vx-Math.sign(vx)*(this.stateMachine.curStateName === "falling" ? Phys.AIR_RESISTANCE*2 : Phys.AIR_RESISTANCE));

                if(this.getXVelocity() !== 0) {
                    const origSign = Math.sign(vx);
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
        const curRoom = this.getLevel().getCurRoom();
        if (this.getY() > curRoom.getY()+curRoom.getHeight() && this.getLevel().inWhichRooms(this).includes(this.getLevel().getCurRoom())) {
            this.getLevel().killPlayer(this.getX(), this.getY());
        }
        this.wasOnGround = onGround;
        // if (this.getSprite().update) this.getSprite().update();
    }

    getTargetPos(carriedBy) {
        let px, py = 0;
        if(carriedBy.onPlayerCollide() === "") {
            px = carriedBy.getX()+PICKUP_POS.x;
            py = carriedBy.getY()-this.getHeight()+(carriedBy.isCrouching() ? 0 : PICKUP_POS.y);
        } else if(carriedBy.onPlayerCollide().includes("booster")) {
            px = carriedBy.getX()+carriedBy.getWidth()/2-this.getWidth()/2;
            py = carriedBy.getY()+carriedBy.getHeight()/2-this.getHeight()/2;
        }
        return BMath.Vector({x:px, y:py});
    }

    fall() {
        super.fall();
        // if(this.getYVelocity() > 1) alert(this.getYVelocity());
    }

    setYVelocity(y) {
        super.setYVelocity(y);
    }
}

class Thrower {
    constructor(v, t) {this.throwable = t; this.throwV = v;}
    throw() {

    }
}

export {Throwable};