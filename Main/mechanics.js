import * as Phys from "./basePhysics.js";
import * as Graphics from "./graphics.js";
import * as BMath from "./bMath.js";
import * as StateMachine from "./stateMachine.js";
import {Throwable} from "./throwable.js";
import {Player} from "./player.js";
import {LAYER_NAMES} from "./map.js";

class PlayerKill extends Phys.Solid {
    constructor(x, y, w, h, level, direction) {
        super(x, y, w, h, null, level, direction);
        // this.tilex = Math.floor(x/TILE_SIZE)*TILE_SIZE;
        // this.tiley = Math.floor(y/TILE_SIZE)*TILE_SIZE;
        // super.setSprite(new Sprite(SPIKES_IMG, direction));
    }

    onPlayerCollide() {return "kill";}

    draw() {
        super.draw("#ff0000");
        Graphics.drawEllipseOnCanvas(10, 10, 5);
        // super.getSprite().draw(this.tilex, this.tiley);
    }
}

class Wall extends Phys.Solid {
    constructor(x, y, w, h, level, tileCode) {
        super(x, y, w, h, [], level, null, true);
    }
}

const dirToSpringV  = dir => {
    switch(dir){
        case BMath.VectorUp: return BMath.Vector({x:0, y:-0.335});
        case BMath.VectorLeft: return BMath.Vector({x:-0.3, y:-0.1});
        case BMath.VectorDown: return BMath.Vector({x:0, y:0.1});
        case BMath.VectorRight: return BMath.Vector({x:0.3, y:-0.1});
        default:
            console.error("ERROR: Invalid direction in dirToSpringV", dir);
            return BMath.VectorUp;
    }
};

class Spring extends Phys.Solid {

    constructor(x, y, w, h, direction, level) {
        super(x, y, w, h, [], level, direction);
        // super.setSprite(new AnimatedSprite(SPRING_SPRITESHEET, direction, [{frames:0, onComplete:null}, {frames:16, onComplete:null}]));
        this.direction = direction;
    }

    draw() {
        super.draw("#ffb5e4");
        // super.getSprite().draw(Math.floor(this.getX()/TILE_SIZE)*TILE_SIZE, this.getY()-TILE_SIZE+this.getHeight());
    }

    updatePhysicsPos() {
        super.updatePhysicsPos();
    }

    onPlayerCollide() {
        return "spring";
    }

    getBounceForce() {
        return dirToSpringV(this.direction);
        const SPRING_SCALAR_X = 0.2;
        const SPRING_SCALAR_Y = 0.2;
        if(this.direction.x === 0) {
            return this.direction.scalar(SPRING_SCALAR_Y);
        }
        else {
            const newV = this.direction.scalar(SPRING_SCALAR_X);
            newV.y = -0.01;
            return newV;
        }
    }

    bounceObj(physObj) {
        const newV = this.getBounceForce();
        if(newV.x) {physObj.setVelocity(newV);}
        else {
            physObj.setYVelocity(newV.y);
        }

        // super.getSprite().setRow(1);
        // audioCon.playSoundEffect(SPRING_SFX);
        // const numDusts = 3;
        // for(let i = 0; i<numDusts; ++i) {
        //     const vx = Math.sign(Math.random()-0.5);
        //     const vy = -Math.random()*2;
        //     this.getLevel().pushDustSprite(new SpringDustSprite(this.getX(), this.getY(), 1, 1, Vector({x:vx, y:vy}), this.level));
        // }
    }
}

class Ice extends Phys.Solid {
    constructor(x, y, w, h, level, tileCode) {
        super(x, y, w, h, [], level, null);
    }

    onPlayerCollide() {
        return super.onPlayerCollide() + " ice";
    }

    draw() {
        super.draw("#03fcf4");
    }
}

class OneWay extends Phys.Solid {
    constructor(x, y, w, h, level, direction, tileCode) {
        super(x, y, w, h, [], level, direction, false);
    }

    onPlayerCollide() {
        return super.onPlayerCollide() + " oneWay";
    }

    draw() {
        super.draw("#934a29");
    }

    isSolid(direction, physObj) {
        const pDy = this.direction.y;
        if (pDy !== 0) {
            if (Math.sign(direction.y) !== Math.sign(pDy)) {
                if (pDy === -1 && !physObj.isOnTopOf(this)) {
                    return false;
                }
            } else {
                return false;
            }
        }
        return true;
    }
}

class Spawn extends Phys.PhysObj {
    constructor(x, y, w, h, level, id, roomId) {
        super(x, y, w, h);
        this.level = level;
        this.spawnId = id;
        this.roomId = roomId;
    }

    draw(color) {
        super.draw(color + "80");
    }

    onPlayerCollide() {return "spawn";}
    getId() {return this.spawnId;}
    move(x, y) {}
}

class Breakable extends Wall {
    constructor(x, y, w, h, level, tileCode) {
        super(x, y, w, h, level, tileCode);
        this.idleUpdate = this.idleUpdate.bind(this);
        this.breakingUpdate = this.breakingUpdate.bind(this);

        this.stateMachine = new StateMachine.StateMachine({
            "idle": {
                onStart: () => {},
                onUpdate: this.idleUpdate,
                transitions: ["breaking"],
            },
            "breaking": {
                maxTimer: 128,
                onStart: () => {},
                onUpdate: this.breakingUpdate,
                timeOutTransition: "broken",
                transitions: ["broken"]
            },
            "broken": {
                onStart: () => {},
                onUpdate: this.idleUpdate,
                transitions: StateMachine.END_STATE,
            },
        })
    }

    draw() {
        if(this.stateMachine.curStateName !== "broken") {
            super.draw();
        } else {
            super.draw("#808080");
        }
    }

    update() {
        this.stateMachine.update();
    }

    idleUpdate() {
        super.update();
    }

    breakingUpdate() {
        this.idleUpdate();
    }

    breakObj() {
        this.stateMachine.transitionTo("breaking");
    }

    playerTouch(player) {
        if(this.stateMachine.curStateName === "idle") {
            const breakables = this.getLevel().getCurRoom().layers.getLayer(LAYER_NAMES.BREAKABLE).objs;
            breakables.forEach(breakable => breakable.breakObj());
        }
    }

    respawnClone() {
        return new Breakable(this.getX(), this.getY(), this.getWidth(), this.getHeight(), this.getLevel());
    }

    isSolid() {
        return this.stateMachine.curStateName !== "broken";
    }

    onPlayerCollide() {
        return super.onPlayerCollide() + " breakable";
    }
}

class PlayerSpawn extends Spawn {
    //entity["x"], entity["y"], tileSize, tileSize*1.5, level, entity["id"], entity["values"]["roomId"]
    constructor(x, y, w, h, level, id) {
        super(x, y, w, h, level, id);
    }
    respawnClone() {return new Player(this.getX(), this.getY(), this.getWidth(), this.getHeight(), this.level);}
    draw() {super.draw("#00ff00");}
    onPlayerCollide() {return "spawnPlayer";}
    update() {
        if(this.getLevel().getCurRoom().getPlayer().isOverlap(this)) {
            this.getLevel().getCurRoom().setSpawnPt(this);
        }
    }
}

class ThrowableSpawn extends Spawn {
    constructor(x, y, w, h, level, id) {
        super(x, y, w, h, level, id);
    }
    respawnClone() {return new Throwable(this.getX(), this.getY(), this.getWidth(), this.getHeight(), this.level);}
    draw() {
        super.draw("#eb9c09");
    }
    onPlayerCollide() {return "spawnThrowable";}
}

class Booster extends Phys.Solid {
    constructor(x, y, w, h, level, direction, maxTimer=1000, throwStrength = 0.3) {
        super(x, y, w, h, [], level, direction);
        this.spawnData = {x:x, y:y, w:w, h:h, level:level, direction:direction, maxTimer:maxTimer, throwStrength:throwStrength};

        let throwV = 0;
        switch(direction) {
            case BMath.VectorUp:
                throwV = throwStrength+0.05;
                break;
            case BMath.VectorLeft:
            case BMath.VectorRight:
                throwV = throwStrength;
                break;
            case BMath.VectorDown:
                throwV = throwStrength-0.1;
                break;
            default:
                console.warn("invalid direction in booster constructor:", direction);
                break;
        }
        this.thrower = new Thrower(BMath.Vector({x:throwV, y:0}), BMath.Vector({x:2,y:2}));
        this.idleUpdate = this.idleUpdate.bind(this);
        this.throw = this.throw.bind(this);
        this.justThrewUpdate = this.justThrewUpdate.bind(this);

        this.pickingColor = "#BFAB00ff";
        this.idleColor = "#BF001C80";

        this.stateMachine = new StateMachine.StateMachine({
            "idle": {
                onStart: () => {},
                onUpdate: this.idleUpdate,
                transitions: ["hasBox"],
            },
            "hasBox": {
                maxTimer: maxTimer,
                onStart: () => {},
                onUpdate: this.idleUpdate,
                timeOutTransition: "boxStillOverlap",
                onComplete: this.throw,
                transitions: ["boxStillOverlap", "idle"],
            },
            "boxStillOverlap": {
                onStart: () => {},
                onUpdate: this.justThrewUpdate,
                transitions: ["idle"]
            }
        });
    }

    releasePicking() {
        this.stateMachine.transitionTo("idle");
        this.thrower.releasePicking();
    }

    draw() {
        let a = 1;
        let curTimer = this.stateMachine.getCurState().curTimer;
        if(curTimer) a = 1-curTimer/this.stateMachine.getCurState().maxTimer;
        const color = `${Graphics.colorLerp(this.pickingColor, this.idleColor, a)}`;
        Graphics.drawRectOnCanvas(this.hitbox.rect, color);
        Graphics.drawImage(this.getX(), this.getY(), "booster_img", {direction: this.direction});
    }

    onPlayerCollide() {
        return "booster";
    }

    onCollide(physObj, direction) {
        return false;
    }

    canPickUp(throwable) {
        return this.justThrew !== throwable && this.thrower.canPickUp(throwable, this);
    }

    boosterPickUp(throwable) {
        this.thrower.pickUp(throwable, this);
        this.stateMachine.transitionTo("hasBox");
    }

    update() {
        this.stateMachine.update();
    }

    respawnClone() {
        const spd = this.spawnData;
        return new Booster(spd.x, spd.y, spd.w, spd.h, spd.level, spd.direction, spd.maxTimer, spd.throwStrength);
    }

    idleUpdate() {
        super.update();
    }

    justThrewUpdate() {
        this.idleUpdate();
        if(!this.justThrew.isOverlap(this)) {
            this.justThrew = null;
            this.stateMachine.transitionTo("idle");
        }
    }

    throw() {
        this.justThrew = this.thrower.getPicking();
        this.thrower.throw(this.direction, 0);
    }
}

class SuperBooster extends Booster {
    constructor(x, y, w, h, level, direction) {
        // constructor(x, y, w, h, level, direction, maxTimer=1000, throwStrength = 0.3)
        super(x, y, w, h, level, direction, 1000, 1);
        console.log(this.thrower);
    }
}

class Thrower {
    constructor(throwV, targetOffset) {
        this.throwV = throwV;
        this.picking = [];
        this.targetOffset = targetOffset;
    }

    pickUp(throwable, physObj) {
        this.picking[0] = throwable;
        throwable.startCarrying(physObj);
    }

    releasePicking() {
        this.picking = [];
    }

    getPicking() {return this.picking[0];}
    setPicking(p) {this.picking[0] = p;}

    canPickUp(throwable, physObj) {
        if(physObj.onPlayerCollide() === "") return true;
        else return !throwable.isBeingCarried();
    }

    throw(direction, xV) {
        let newThrowV = null;
        if(direction.y !== 0) {
            newThrowV = BMath.Vector({x:this.throwV.y, y:this.throwV.x*direction.y});
        } else {
            newThrowV = this.throwV.scalarX(direction.x);
        }
        this.getPicking().setXVelocity(newThrowV.x);
        this.getPicking().setYVelocity(newThrowV.y);
        this.getPicking().throw();
        this.releasePicking();
    }

    setTargetOffset(t) {this.targetPos = t;}
    getTargetOffset() {return this.targetOffset;}
}

export {
    Wall, Breakable, OneWay, Ice, Spring, PlayerKill, PlayerSpawn, ThrowableSpawn, Booster, SuperBooster, Thrower
}