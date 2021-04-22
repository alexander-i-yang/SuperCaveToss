import * as Phys from "./basePhysics.js";
import * as Graphics from "./graphics.js";
import * as BMath from "./bMath.js";
import {StateMachine} from "./stateMachine.js";
import {Throwable} from "./throwable.js";
import {Player} from "./player.js";

const SPRING_SCALAR_Y = 0.4;
const SPRING_SCALAR_X = 0.4;

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
        if(this.direction.x === 0) return this.direction.scalar(SPRING_SCALAR_Y);
        else {
            const newV = this.direction.scalar(SPRING_SCALAR_X);
            newV.y = -1;
            return newV;
        }
    }

    bounceObj(physObj) {
        const newV = this.getBounceForce();
        if(newV.x) {physObj.setVelocity(newV);}
        else {physObj.setYVelocity(newV.y);}
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
    constructor(x, y, w, h, room) {
        super(x, y, w, h, [], room);
    }

    onPlayerCollide() {
        return super.onPlayerCollide() + " ice";
    }

    draw() {
        super.draw("#03fcf4");
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

    getId() {return this.spawnId;}

    getRoomId() {return this.roomId;}

    move(x, y) {}
}

class PlayerSpawn extends Spawn {
    //entity["x"], entity["y"], tileSize, tileSize*1.5, level, entity["id"], entity["values"]["roomId"]
    constructor(x, y, w, h, level, id) {
        super(x, y, w, h, level, id);
    }
    respawnClone() {return new Player(this.getX(), this.getY(), this.getWidth(), this.getHeight(), this.level);}
    draw() {super.draw("#00ff00");}
}

class ThrowableSpawn extends Spawn {
    constructor(x, y, w, h, level, id) {
        super(x, y, w, h, level, id);
    }
    respawnClone() {return new Throwable(this.getX(), this.getY(), this.getWidth(), this.getHeight(), this.level);}
    draw() {
        super.draw("#eb9c09");
    }
}

class Booster extends Phys.Solid {
    constructor(x, y, w, h, level, direction, maxTimer=60) {
        super(x, y, w, h, [], level, direction);
        this.spawnData = {x:x, y:y, w:w, h:h, level:level, direction:direction, maxTimer:maxTimer};
        this.thrower = new Thrower(BMath.Vector({x:0.3,y:0}), BMath.Vector({x:2,y:2}));
        this.idleUpdate = this.idleUpdate.bind(this);
        console.log(direction, this.direction);
        this.throw = this.throw.bind(this);
        this.justThrewUpdate = this.justThrewUpdate.bind(this);

        this.pickingColor = "#BFAB00ff";
        this.idleColor = "#BF001C80";

        this.stateMachine = new StateMachine({
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
        return new Booster(spd.x, spd.y, spd.w, spd.h, spd.level, spd.direction, spd.maxTimer);
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
        this.justThrew = this.thrower.picking;
        this.thrower.throw(this.direction, 0);
    }
}

class Thrower {
    constructor(throwV, targetOffset) {
        this.throwV = throwV;
        this.picking = null;
        this.targetOffset = targetOffset;
    }

    pickUp(throwable, physObj) {
        this.picking = throwable;
        throwable.startCarrying(physObj);
    }

    releasePicking() {this.picking = null;}

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
        this.picking.setXVelocity(newThrowV.x);
        this.picking.setYVelocity(newThrowV.y);
        this.picking.throw();
        this.releasePicking();
    }

    setTargetOffset(t) {this.targetPos = t;}
    getTargetOffset() {return this.targetOffset;}
}

export {
    Wall, Ice, Spring, PlayerKill, PlayerSpawn, ThrowableSpawn, Booster, Thrower
}