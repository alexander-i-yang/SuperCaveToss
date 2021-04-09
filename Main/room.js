// import * as BMath from "./bMath";
// import {Player} from "./player";
// import {Throwable} from "./throwable";
// import {StateMachine} from "./stateMachine";
// import * as Graphics from "./graphics";
// import * as Phys from './basePhysics';

function loadRooms() {

}

class Room {
    constructor(tileArr, game) {
        this.game = game;
        this.layers = {
            "walls": new Phys.Layer(true),
            "staticSpikes": new Phys.Layer(true),
            "switchBlocks": new Phys.Layer(false),
            "actors": new Phys.Layer(false),
        };
        this.throwables = [];
        // convertWallTiles(tileArr);
        const yLen = tileArr.length;
        const xLen = tileArr[0].length;
        for(let y = 0; y<yLen; y++) {
            for(let x = 0; x<xLen; x++) {
                const gameSpaceX = x*TILE_SIZE;
                const gameSpaceY = y*TILE_SIZE;
                const tileCode = parseInt(tileArr[y][x]);
                const direction = BMath.numToVec(tileCode%4);
                if(tileCode !== 0) {
                    switch(Math.floor(tileCode/4)) {
                        case 0:
                            this.layers["walls"].pushObj(new Wall(gameSpaceX, gameSpaceY, TILE_SIZE, TILE_SIZE, this));
                            break;
                        case 1:
                            const player = new Player(gameSpaceX, gameSpaceY, TILE_SIZE, TILE_SIZE*1.5, this);
                            this.layers["actors"].pushObj(player);
                            this.player = player;
                            break;
                        case 2:
                            const throwable = new Throwable(gameSpaceX, gameSpaceY+1, TILE_SIZE, TILE_SIZE, this);
                            this.layers["actors"].pushObj(throwable);
                            this.throwables.push(throwable);
                            break;
                        case 3:
                            this.layers["walls"].pushObj(new Spring(gameSpaceX, gameSpaceY+TILE_SIZE/2+2, TILE_SIZE, 2, direction, this));
                            break;
                        case 4:
                            this.layers["walls"].pushObj(new Ice(gameSpaceX, gameSpaceY, TILE_SIZE, TILE_SIZE, this));
                            break;
                        case 5:
                            this.layers["staticSpikes"].pushObj(new PlayerKill(gameSpaceX, gameSpaceY+TILE_SIZE/2+2, TILE_SIZE, 2, this, direction));
                            break;
                        case 8:
                            this.layers["switchBlocks"].pushObj(new SwitchBlock(gameSpaceX, gameSpaceY+TILE_SIZE/2+2, TILE_SIZE, 10, ["actors"], this, null));
                            break;
                        default:
                            break;
                    }
                }
            }
        }
        this.endLevelFrames = 0;
        this.opacity = 0;

        this.forEachLayer(layer => {
            layer.sortObjs();
        });
        this.idleUpdate = this.idleUpdate.bind(this);
        this.resetRoom = this.resetRoom.bind(this);
        this.stateMachine = new StateMachine({
            "spawn": {
                maxTimer: 5,
                onStart: this.resetRoom,
                onUpdate: () => {
                    // console.log("spawn update")
                },
                timeOutTransition: "idle",
                transitions: ["idle"]
            },
            "idle": {
                onStart: () => {
                    // console.log("on idle start")
                },
                onUpdate: this.idleUpdate,
                transitions: ["death", "nextLevel"]
            },
            "death": {
                maxTimer: 10,
                onStart: (deathPos) => {
                    // console.log("death start", deathPos)
                },
                onUpdate: () => {
                    // console.log("death update")
                },
                timeOutTransition: "spawn",
                transitions: ["idle", "spawn"],
            },
            "nextLevel": {
                timer: 15,
                onComplete: () => {
                    // console.log("next level complete")
                },
                timeOutTransition: "END"
            }
        });
    }

    forEachLayer(f) {
        Object.keys(this.layers).forEach(k => {
            f(this.layers[k]);
        });
    }

    drawAll() {
        // this.decorations.forEach(curItem => {curItem.draw();});
        this.forEachLayer(layer => {layer.drawAll();});
    }
    endGame() {}
    checkCollide(physObj, offset) {
        let ret = null;
        physObj.collisionLayers.some(layerName => {
            const c = this.layers[layerName].checkCollide(physObj, offset);
            if(c) {
                ret = c;
                return c;
            }
        });
        return ret;
    }
    pushDecoration(d) {this.decorations.push(d);}
    pushDustSprite(g) {
        this.dustSprites.push(g);
    }
    removeDecoration(d) {
        const index = this.decorations.findIndex(de => de.id === d.id);
        if (index > -1) {
          this.decorations.splice(index, 1);
        }
    }
    removeDustSprite(d) {
        const index = this.dustSprites.indexOf(d);
        if (index > -1) {
            this.dustSprites.splice(index, 1);
        }
    }
    update() {
        this.stateMachine.update();
    }
    idleUpdate() {
        // this.getAllGeometry().forEach(geom => {geom.update();});
        // this.decorations.forEach(decoration => {decoration.update();});
        // this.dustSprites.forEach(g => {g.update()});
        try {
            this.forEachLayer(layer => {layer.update();});
            if(this.checkNextRoom()) {
                this.stateMachine.transitionTo("nextRoom");
            }
        } catch (error) {
            console.warn("error: in room udpate", error);
            this.killPlayer();
        }
        // if(this.endLevelFrames === 1) {
        //     this.game.nextLevel();
        //     this.endLevelFrames = 0;
        // }
        if(this.checkPlayerFallDeath() && !this.checkNextRoom()) {
            this.stateMachine.transitionTo("death");
        }
        // if(!this.faded && game.onStickyLevel() && game.getCurrentRoom() === this && this.player.getX() > 80) {
        //     this.faded = true;
        //     audioCon.fadeOutSong(750);
        // }
        // if(this.endLevelFrames > 1) {
        //     this.endLevelFrames -= 1;
        //     this.fade(1-this.endLevelFrames/32);
        // }
    }

    getAllGeometry() {return this.layers["walls"].objs.concat(this.layers["actors"].objs);}
    getAllItems() {return this.getAllGeometry().concat(this.decorations);}

    isOnGround(actor) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            this.layers[layerName].objs.forEach(solid => {
                const pC = solid.onPlayerCollide();
                if((pC.includes("wall") || pC === "") && actor.isOnTopOf(solid)) {
                    ret = solid;
                    return true;
                }
            })
        });
        return ret;
    }

    isOnWallGrindable(actor) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            this.layers[layerName].forEachSlicedObjs(actor.getX()-TILE_SIZE, actor.getX()+actor.getWidth()+TILE_SIZE, obj => {
                if(obj.isWallGrindable() && (actor.isLeftOf(obj) || obj.isLeftOf(actor))) {
                    ret = obj;
                    return true;
                }
            });
        });
        return ret;
    }

    isOnIce(actor) {
        let ret = null;
        (this.solids.concat(this.actors)).some(solid => {
                if((solid.onPlayerCollide().includes("ice")) && actor.isOnTopOf(solid)) {
                    ret = solid;
                    return true;
                }
            }
        );
        return ret;
    }

    isPushUp(actor) {
        let ret = false;
        this.actors.some(curActor => {
            if(actor !== curActor && (curActor.onPlayerCollide().includes("throwable") || curActor.onPlayerCollide() === "") && actor.isUnder(curActor)) {
                ret = curActor;
                return true;
            }
        });
        return ret;
    }

    getAllRidingActors(solid) {
        let ret = [];
        this.layers["actors"].objs.forEach(actor => {
            if(actor.isRiding(solid)) {
                ret.push(actor);
            }
        });
        return ret;
    }

    resetRoom() {
        this.game.respawn();
        this.throwables = [];
        this.layers["actors"].objs = this.layers["actors"].objs.map(actor => {
            const newActor = actor.respawnClone(this);
            if(actor.onPlayerCollide() === "") {
                this.player = newActor;
            }
            else if(actor.onPlayerCollide().includes("throwable")) {this.throwables.push(newActor);}
            return newActor;
        });
    }

    killPlayer(x, y) {
        this.stateMachine.transitionTo("death", {x:x, y:y});
        game.death();
        // audioCon.playSoundEffect(DEATH_SFX);
    }

    setKeys(keys) {
        this.player.setKeys(keys);
        this.layers["switchBlocks"].objs.forEach(blk => {blk.setKeys(keys);});
    }

    isTouchingThrowable(physObj) {
        let ret = null;
        this.throwables.some(t => {
            if(physObj.isTouching(t.getHitbox())) {
                ret = t;
                return;
            }
        });
        return ret;
    }
    getActors() {return this.layers["actors"].objs;}
    // getDecorations() {return this.decorations;}
    getPlayer() {return this.player;}
    getGame() {return this.game;}

    checkNextRoom() {
        return this.player.getX() <= 0 || this.player.getX() + this.player.getWidth() >= Graphics.CANVAS_SIZE[0]
    }

    checkPlayerFallDeath() {
        return this.player.getY() > Graphics.CANVAS_SIZE[1];
    }

    fade(opacity) {
        this.opacity = opacity;
    }

    drawFade()  {
        CTX.fillStyle = `rgba(0, 0, 0, ${this.opacity})`;
        CTX.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);
    };
}

export {
    Room,
}