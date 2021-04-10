import * as Phys from "./basePhysics.js";
import * as Graphics from "./graphics.js";
import * as BMath from "./bMath.js";

class PlayerKill extends Phys.Solid {
    constructor(x, y, w, h, level, tileCode) {
        const direction = BMath.numToVec(tileCode);
        super(x, y, w, h, null, level, direction);
        this.tilex = Math.floor(x/TILE_SIZE)*TILE_SIZE;
        this.tiley = Math.floor(y/TILE_SIZE)*TILE_SIZE;
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
    constructor(x, y, w, h, room, tileCode) {
        super(x, y, w, h, [], room, null, true);
    }
}

class Spring extends Phys.Solid {

    constructor(x, y, w, h, direction, room) {
        super(x, y, w, h, [], room, direction);
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

class Spawn extends Phys.Hitbox {
    constructor(x, y, w, h, room, id) {
        super(x, y, w, h);
        this.room = room;
        this.spawnId = id;
    }

    draw(color) {
        super.draw(color + "80");
    }

    getId() {return this.spawnId;}
}

class PlayerSpawn extends Spawn {
    constructor(x, y, w, h, room, id) {
        super(x, y, w, h, room, id);
    }
    draw() {super.draw("#00ff00");}
}

class ThrowableSpawn extends Spawn {
    constructor(x, y, w, h, room, id) {
        super(x, y, w, h, room);
    }
    draw() {
        super.draw("#eb9c09");}
}

export {
    Wall, Ice, Spring, PlayerKill, PlayerSpawn, ThrowableSpawn
}