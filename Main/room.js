import * as BMath from "./bMath.js";
import {Player} from "./player.js";
import {Throwable} from "./throwable.js";
import {StateMachine} from "./stateMachine.js";
import * as Graphics from "./graphics.js";
import * as Phys from './basePhysics.js';
import * as Mechanics from './mechanics.js';

const LAYER_TO_OBJ = {
    "walls": (x, y, room, tileData, tileSize) => new Mechanics.Wall(x, y, tileSize, tileSize, room, tileData),
    "staticSpikes": (x, y, room, tileData, tileSize) => new Mechanics.PlayerKill(x, y + tileSize / 2 + 2, tileSize, 2, room, tileData),
    "playerSpawns": (x, y, room, id, tileSize) => new Mechanics.PlayerSpawn(x, y+Graphics.TILE_SIZE/2, tileSize, tileSize*1.5, room, id),
    "throwableSpawns": (x, y, room, id, tileSize) => new Mechanics.ThrowableSpawn(x, y, tileSize, tileSize, room, id),
    // "actors": (x, y, w, h, room, tileCode) => new Mechanics.PlayerKill(x, y, w, h, room, tileCode)
};

class Room {
    constructor(data, game) {
        this.game = game;
        this.layers = {
            "walls": new Phys.Layer(true),
            "staticSpikes": new Phys.Layer(true),
            "playerSpawns": new Phys.Layer(true),
            "throwableSpawns": new Phys.Layer(true),
            // "switchBlocks": new Phys.Layer(false),
            "actors": new Phys.Layer(false),
        };
        this.throwables = [];
        // convertWallTiles(tileArr);
        this.pixelWidth = 0;
        this.pixelHeight = 0;

        data.layers.forEach(layer => {
            const layerName = layer["name"];
            const yLen = layer["gridCellsY"];
            const xLen = layer["gridCellsX"];
            const gridCellWidth = Graphics.TILE_SIZE;
            const layerObjs = layer["data2D"];
            const entities = layer["entities"];
            const dataCoords = layer["dataCoords2D"];
            if(layerObjs) {
                for (let y = 0; y < yLen-1; y++) {
                    for (let x = 0; x < xLen; x++) {
                        const gameSpaceX = x * gridCellWidth;
                        const gameSpaceY = y * gridCellWidth;
                        // console.log(layerObjs.length, y);
                        // console.log(layerObjs[y]);
                        const tileCode = parseInt(layerObjs[y][x]);
                        if(tileCode === 0 || tileCode === -1) {
                            // console.log(tileCode);
                        } else {
                            const newObj = LAYER_TO_OBJ[layerName](gameSpaceX, gameSpaceY, this, tileCode, gridCellWidth);
                            this.layers[layerName].pushObj(newObj);
                        }
                    }
                }
            } else if(dataCoords) {
                for (let y = 0; y < yLen-1; y++) {
                    for (let x = 0; x < xLen; x++) {
                        const gameSpaceX = x * gridCellWidth;
                        const gameSpaceY = y * gridCellWidth;
                        // console.log(layerObjs.length, y);
                        // console.log(layerObjs[y]);
                        const tileArr = dataCoords[y][x];
                        if(tileArr[0] === -1 || (tileArr[0] === 0 && tileArr[0] === 0)) {
                            // console.log(tileCode);
                        } else {
                            const newObj = LAYER_TO_OBJ[layerName](gameSpaceX, gameSpaceY, this, tileArr, gridCellWidth);
                            this.layers[layerName].pushObj(newObj);
                        }
                    }
                }
            } else if(entities) {
                entities.forEach(entity => {
                    const newObj = LAYER_TO_OBJ[layerName](entity["x"], entity["y"], this, entity["id"], gridCellWidth);
                    this.layers[layerName].pushObj(newObj);
                })
            }
        });

        // const direction = BMath.numToVec(tileCode % 4);
                    // if (tileCode !== 0) {
                    //     switch (Math.floor(tileCode / 4)) {
                    //         case 0:
                    //             this.layers["walls"].pushObj(new Wall(gameSpaceX, gameSpaceY, TILE_SIZE, TILE_SIZE, this));
                    //             break;
                    //         case 1:
                    //             const player = new Player(gameSpaceX, gameSpaceY, TILE_SIZE, TILE_SIZE * 1.5, this);
                    //             this.layers["actors"].pushObj(player);
                    //             this.player = player;
                    //             break;
                    //         case 2:
                    //             const throwable = new Throwable(gameSpaceX, gameSpaceY + 1, TILE_SIZE, TILE_SIZE, this);
                    //             this.layers["actors"].pushObj(throwable);
                    //             this.throwables.push(throwable);
                    //             break;
                    //         case 3:
                    //             this.layers["walls"].pushObj(new Spring(gameSpaceX, gameSpaceY + TILE_SIZE / 2 + 2, TILE_SIZE, 2, direction, this));
                    //             break;
                    //         case 4:
                    //             this.layers["walls"].pushObj(new Ice(gameSpaceX, gameSpaceY, TILE_SIZE, TILE_SIZE, this));
                    //             break;
                    //         case 5:
                    //             this.layers["staticSpikes"].pushObj(new PlayerKill(gameSpaceX, gameSpaceY + TILE_SIZE / 2 + 2, TILE_SIZE, 2, this, direction));
                    //             break;
                    //         case 8:
                    //             this.layers["switchBlocks"].pushObj(new SwitchBlock(gameSpaceX, gameSpaceY + TILE_SIZE / 2 + 2, TILE_SIZE, 10, ["actors"], this, null));
                    //             break;
                    //         default:
                    //             break;
                    //     }
                    // }

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
                transitions: ["death", "nextRoom"]
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
            "nextRoom": {
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
        const playerPos = this.getPlayer().getPos();
        // const clampedX =
        // Graphics.centerCamera({});
        Object.keys(this.layers).forEach(layerName => {
            const curLayer = this.layers[layerName];
            if(Phys.DEBUG) curLayer.drawAll();
            else {
                if(!layerName.includes("Spawns")) {
                    curLayer.drawAll();
                }
            }
        });
    }
    endGame() {}
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
            if(this.stateMachine.curStateName === "idle" && this.player) {
                if (this.checkPlayerFallDeath() && !this.checkNextRoom()) {
                    this.stateMachine.transitionTo("death");
                }
                if (this.checkNextRoom()) {
                    this.stateMachine.transitionTo("nextRoom");
                }
            }
        } catch (error) {
            console.warn("error: in room udpate", error);
            this.killPlayer();
        }
        // if(this.endLevelFrames === 1) {
        //     this.game.nextLevel();
        //     this.endLevelFrames = 0;
        // }
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

    collisionLayerSome(actor, forEachLayer) {
        let ret = null;
        actor.collisionLayers.some(layerName => {
            const curLayer = this.layers[layerName];
            if(curLayer) {
                const result = forEachLayer(curLayer);
                if(result) {ret = result; return true;}
            }
        });
        return ret;
    }

    checkCollide(physObj, offset) {
        return this.collisionLayerSome(physObj, curLayer => {
            return curLayer.checkCollide(physObj, offset);
        });

        // let ret = null;
        // physObj.collisionLayers.some(layerName => {
        //     const c = this.layers[layerName].checkCollide(physObj, offset);
        //     if(c) {
        //         ret = c;
        //         return c;
        //     }
        // });
        // return ret;
    }


    isOnGround(actor) {
        return this.collisionLayerSome(actor, curLayer => {
            let ret = null;
            curLayer.objs.some(solid => {
                const pC = solid.onPlayerCollide();
                if ((pC.includes("wall") || pC === "") && actor.isOnTopOf(solid)) {
                    ret = solid;
                    return true;
                }
            });
            return ret;
        });
        //
        // let ret = null;
        // actor.collisionLayers.some(layerName => {
        //     if(this.layers[layerName]) {
        //         this.layers[layerName].objs.forEach(solid => {
        //             const pC = solid.onPlayerCollide();
        //             if((pC.includes("wall") || pC === "") && actor.isOnTopOf(solid)) {
        //                 ret = solid;
        //                 return true;
        //             }
        //         })
        //     }
        // });
        // return ret;
    }

    isOnWallGrindable(actor) {
        return this.collisionLayerSome(actor, curLayer => {
            let ret = null;
            curLayer.objs.some(solid => {
                if(solid.isWallGrindable() && (actor.isLeftOf(solid) || solid.isLeftOf(actor))) {
                    ret = solid;
                    return true;
                }
            });
            return ret;
        });

        // let ret = null;
        // actor.collisionLayers.some(layerName => {
        //     this.layers[layerName].forEachSlicedObjs(actor.getX()-Graphics.TILE_SIZE, actor.getX()+actor.getWidth()+TILE_SIZE, obj => {
        //         if(obj.isWallGrindable() && (actor.isLeftOf(obj) || obj.isLeftOf(actor))) {
        //             ret = obj;
        //             return true;
        //         }
        //     });
        // });
        // return ret;
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
        //If it's the first time starting the room, populate this.actors with new actors for every spawn layer. For the player, set the spawn point to the spawn with the first id.
        if(this.layers["actors"].objs.length === 0) {
            const firstPlayerSpawn = this.layers["playerSpawns"].objs.reduce((min, current) => {
                if(min.getId() > current.getId()) return current;
                else return min;
            });

            this.player = new Player(firstPlayerSpawn.getX(), firstPlayerSpawn.getY(), Graphics.TILE_SIZE, Graphics.TILE_SIZE*1.5, this);
            this.layers["actors"].pushObj(this.player);

            this.layers["throwableSpawns"].objs.map(spawn => {
                const newThrowable = new Throwable(spawn.getX(), spawn.getY(), Graphics.TILE_SIZE, Graphics.TILE_SIZE, this);
                this.throwables.push(newThrowable);
                this.layers["actors"].pushObj(newThrowable);
            });
        }

        this.layers["actors"].objs = this.layers["actors"].objs.map(actor => {
            const newActor = actor.respawnClone(this);
            if(actor.onPlayerCollide() === "") {
                this.player = newActor;
            }
            else if(actor.onPlayerCollide().includes("throwable")) {this.throwables.push(newActor);}
            return newActor;
        });
        console.log(this.layers["actors"].objs);
    }

    killPlayer(x, y) {
        this.stateMachine.transitionTo("death", {x:x, y:y});
        this.game.death();
        // audioCon.playSoundEffect(DEATH_SFX);
    }

    setKeys(keys) {
        if(this.player) this.player.setKeys(keys);
        if(this.layers["switchBlocks"]) this.layers["switchBlocks"].objs.forEach(blk => {blk.setKeys(keys);});
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
        return false;
        // console.log(this.pixelWidth);
        // return this.player.getX() <= 0 || this.player.getX() + this.player.getWidth() >= this.pixelWidth;
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