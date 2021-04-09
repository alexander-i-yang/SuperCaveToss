/*
  &&%%%%%#, #&&%%%%@&/ /&%.    @&( ,&&&%%%%%#       *&&&@&%%%#  ///////////// .&&&&&@@&%  &&&&&@@&%,
 &&(        #&%,***&%/ /&%.    &&( *@&/,,,,,           (&&#     //#########// .&&(,,,,,   &&#,,,,,.
 @&(        #&@###%&%/ /&%.    &&( ,&&%######          (&&#     //#########//  ,@&&&&&&%   @&&&&&&%,
 &&(        %&#   .@&/  .#&&(&&%.  ,&%*                (&@%     //#########//        #@%        *@%,
  %%&&&%%%, #&#   .%%/     /%/     .#&&&%%%%#          (%%(     ///////////// .%%%&&&%%#  %%%&&&%%%,

  Super Cave Toss source code by Alex Yang
  Started 4/5/2021
  Physics code influenced by Maddy Thorson's  article at https://maddythorson.medium.com/celeste-and-towerfall-physics-d24bd2ae0fc5
 */

import * as BMath from './bMath.js';
import * as Phys from './basePhysics.js';
import * as Graphics from './graphics.js';
import * as Room from './room.js';

const TILE_SIZE = Graphics.TILE_SIZE;
const SPRING_SCALAR_Y = 4*Phys.PHYSICS_SCALAR;
const SPRING_SCALAR_X = 4*Phys.PHYSICS_SCALAR;

// const TILE_MAP = [
//     [
//         ["01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "00", "01", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "01", "00", "00", "00", "00", "00", "00", "01", "01", "01", "01", "00", "00", "00", "00", "00", "00", "00", "00", "01", "01"],
//         ["01", "00", "00", "00", "01", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "16", "16", "16", "00", "00", "00", "01", "01"],
//         ["01", "00", "00", "00", "01", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "16", "00", "00", "00", "00", "00", "01", "01"],
//         ["01", "00", "00", "00", "01", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "16", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "00", "00", "01", "00", "00", "00", "16", "00", "00", "00", "00", "00", "00", "16", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "00", "00", "01", "00", "00", "00", "16", "16", "00", "00", "00", "00", "00", "16", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "23", "16", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "23", "16", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "16", "00", "00", "00", "01", "01", "00", "00", "00", "00", "00", "00", "00", "01", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "16", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "00", "01", "01"],
//         ["01", "04", "00", "00", "00", "08", "00", "00", "16", "08", "00", "08", "01", "00", "00", "00", "00", "00", "00", "00", "00", "01", "01"],
//         ["01", "00", "00", "00", "00", "00", "00", "00", "16", "00", "00", "00", "01", "00", "00", "01", "00", "00", "00", "00", "00", "01", "01"],
//         ["01", "01", "01", "01", "01", "01", "20", "20", "16", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01", "01"],
//     ]
// ];

const SCREEN_SHAKES = [
    BMath.Vector({x: 0, y:0}),
    BMath.Vector({x: -2, y:-2}),
    BMath.Vector({x: -2, y:-2}),
    BMath.Vector({x: 0, y:-2}),
    BMath.Vector({x: 0, y:-2}),
    BMath.Vector({x: 2, y:0}),
    BMath.Vector({x: 2, y:0}),
    BMath.Vector({x: 0, y:0}),
    BMath.Vector({x: 0, y:0}),
];

class SwitchBlock extends Phys.Solid {
    constructor(x, y, w, h, collideLayers, room, direction) {
        super(x, y, w, h, collideLayers, room, direction);
        this.origY = y;
        this.moved = 0;
    }

    update() {
        super.update();
        if(this.getYVelocity() !== 0) {this.moved += 1;}
        if(this.moved > 10) {
            this.setYVelocity(0);
            this.moved = 0;
        } else {
            this.setYVelocity(this.getYVelocity()*1.3);
        }
    }

    draw() {super.draw("#ffffff")}

    startMove() {
        if(this.getY() > this.origY) {
            this.setYVelocity(-1);
        } else {
            this.setYVelocity(1);
        }
    }

    setKeys(k) {
        if(k["KeyC"] === 2 && this.moved === 0) {
            this.startMove();
        }
    }
}

class Option {
    constructor(txt, pos, zPressed) {
        this.txt = txt;
        this.pos = pos;
        this.color = "#C2C3C7";
        this.zPressed = zPressed;
    }

    draw(selected) {
        Graphics.writeText(
            this.getFormattedTxt(selected),
            1,
            this.pos,
            selected ? this.color : "#5F574F",
            0,
            true,
        )
    }

    setKeys(k) {
        if(k["KeyZ"] === 2) this.zPressed();
    }

    getFormattedTxt() {return this.txt}
}

class SliderOption extends Option {
    constructor(txt, pos, valChange) {
        super(txt, pos, null);
        this.valChange = valChange;
        this.val = 10;
    }

    getFormattedTxt(selected) {
        return this.txt.replace(" {{val}} ", selected ? `\<${this.val}\>` : this.val);
    }

    setKeys(k) {
        let valChange = false;
        if(k["ArrowLeft"] === 2) {
            this.val = Math.max(this.val-1, 0);
            valChange = true;
        } else if(k["ArrowRight"] === 2) {
            this.val = Math.min(this.val+1, 10);
            valChange = true;
        }
        if(valChange) {
            this.valChange(this.val);
            // audioCon.playSoundEffect(PING_SFX);
        }
    }
}

class BrokenTextOption extends Option {
    constructor(txt, pos, onFill, onCorrect) {
        super(txt, pos, null);
        this.brokenTextField = new BrokenTextField(this.pos.addPoint(BMath.Vector({x:0, y:8})), onFill, 6, onCorrect);
    }

    setKeys(k) {
        this.brokenTextField.setKeys(k);
    }

    draw(selected) {
        super.draw(selected);
        if(selected) {this.brokenTextField.draw("#FFF1E8");}
    }
}
class BrokenTextField {
    constructor(pos, onFill, length, onCorrect) {
        this.pos = pos;
        this.onFill = onFill;
        this.onCorrect = onCorrect;
        this.length = length;
        this.reset();
        this.shakeWrongFrames = 0;
        this.shakeRightFrames = 0;
    }

    draw() {
        const offset = BMath.Vector({x:0, y:0});
        let specialColor = null;
        if(this.shakeWrongFrames > 0) {
            this.shakeWrongFrames -= 1;
            offset.x = Math.round(Math.sin(this.shakeWrongFrames*Math.PI/4));
            specialColor = "#FF004D";
            if(this.shakeWrongFrames === 0) this.reset();
        } else if(this.shakeRightFrames > 0) {
            this.shakeRightFrames -= 1;
            offset.y = Math.round(2*Math.sin(this.shakeRightFrames*Math.PI/6));
            specialColor = "#00E436";
            if(this.shakeRightFrames === 0) {
                this.onCorrect(this.getTextString());
                this.reset();
            }
        }
        for(let i = 0; i<this.length; ++i) {
            const white = (this.curInd === i) && Math.floor(Graphics.animFrame/4) > 3;
            let color = null;
            if(specialColor != null) {color = specialColor;}
            else {color = white ? "#FFF1E8" : "#5F574F";}
            Graphics.drawRectOnCanvas(new BMath.Rectangle(this.pos.x+i*8+offset.x, this.pos.y+8+offset.y, 6, 1), color, true);
            Graphics.writeText(this.txt[i], 1, this.pos.addPoint(BMath.Vector({x:1+i*8, y:1})).addPoint(offset), color, 2, true);
        }
    }

    setKeys(k) {
        const btf = this;
        Object.keys(k).map(function(key) {
            if((key.includes("Key") || key.includes("Digit")) && k[key] === 2) {
                btf.txt[btf.curInd] = key.slice(-1);
                btf.curInd = Math.min(btf.curInd+1, btf.length-1);
                // audioCon.playSoundEffect(PING_SFX);
            }
        });
        const kBack = k["Backspace"];
        if(!this.prevBack && kBack) {
            this.curInd = Math.max(0, this.curInd-1);
            this.txt[this.curInd] = "";
            // audioCon.playSoundEffect(PONG_SFX);
        }
        //     this.curInd = Math.max(this.curInd-1, 0);
        //     audioCon.playSoundEffect(PONG_SFX);
        // } else if(!this.prevRight && kRight) {
        //     this.curInd = Math.min(this.curInd+1, this.length-1);
        //     audioCon.playSoundEffect(PONG_SFX);
        // }
        this.prevBack = kBack;
        if(this.shakeWrongFrames === 0 && this.shakeRightFrames === 0 && this.getTextString().length === this.length) {
            this.onFill(this, this.getTextString());
        }
    }

    getTextString() {return this.txt.join("");}

    reset() {
        this.curInd = 0;
        this.txt = [];
        for(let i = 0; i<this.length; ++i) {this.txt.push("");}
    }

    shakeWrong() {
        this.shakeWrongFrames = 20;
    }

    shakeRight() {this.shakeRightFrames = 20;}
}

class OptionsController {
    constructor() {
        this.bgRect = new BMath.Rectangle(0, 0, Graphics.CANVAS_SIZE[0], Graphics.CANVAS_SIZE[1]);
        this.optionsPos = BMath.Vector({x:30, y:30});
        this.optionsRect = new BMath.Rectangle(this.optionsPos.x, this.optionsPos.y, Graphics.CANVAS_SIZE[0]-this.optionsPos.x*2, Graphics.CANVAS_SIZE[1]-this.optionsPos.y*2);
        this.otherRect = new BMath.Rectangle(this.optionsPos.x-2, this.optionsPos.y-2, Graphics.CANVAS_SIZE[0]-this.optionsPos.x*2+4, Graphics.CANVAS_SIZE[1]-this.optionsPos.y*2+4);
        this.showing = false;
        this.optionInd = 0;
        this.options = [
            new Option("Resume", this.optionsPos.addPoint({x:4, y:14}), () => {this.showing = false;}),
            new SliderOption("Music vol: {{val}} ", this.optionsPos.addPoint({x:4, y:20}), (val) => {audioCon.setMusicVolume(val*0.1);}),
            new SliderOption("SFX vol: {{val}} ", this.optionsPos.addPoint({x:4, y:26}), (val) => {audioCon.setSFXVolume(val*0.1);}),
            new BrokenTextOption(
                "Cheat code",
                this.optionsPos.addPoint({x:4, y:32}),
                (field, text) => {
                    text = text.toLowerCase();
                    if(game.checkCheatCode(text)) {
                        field.shakeRight();
                        // audioCon.playSoundEffect(CORRECT_SFX);
                    } else {
                        // audioCon.playSoundEffect(INCORRECT_SFX);
                        field.shakeWrong();
                    }},
                (text) => {
                    this.showing = false;
                    game.applyCheatCode(text.toLowerCase());
                }
                ),
        ]
    }

    draw() {
        Graphics.drawRectOnCanvas(this.bgRect, "#00000080", true);
        Graphics.drawRectOnCanvas(this.otherRect, "#1D2B53", true);
        Graphics.drawRectOnCanvas(this.optionsRect, "#000000", true);
        Graphics.writeText("Options", 1, this.optionsPos.addPoint(BMath.Vector({x:4,y:4})), "#FFF1E8", 0, true);

        this.options.forEach((option, i) => {
            option.draw(i === this.optionInd);
        });
    }

    setKeys(k) {
        const len = this.options.length;
        let incrBy = 0;
        const kDown = k["ArrowDown"];
        const kUp = k["ArrowUp"];
        if(!this.prevDown && kDown) incrBy = 1;
        else if(!this.prevUp && kUp) incrBy = -1;
        // if(incrBy !== 0) audioCon.playSoundEffect(PONG_SFX);

        this.optionInd = (this.optionInd+(incrBy)+len)%len;
        this.options[this.optionInd].setKeys(k);
        this.prevUp = kUp;
        this.prevDown = kDown;
    }

    toggleOptions() {
        this.showing = !this.showing;

    }
}

const optionsCon = new OptionsController();

class Game {
    constructor(tilemap) {
        this.rooms = [];
        this.startTime = window.performance.now();
        tilemap.map(roomArr => {
            let room = null;
            // if(levelInd === 0) {level = new StartScreen(sliceArr, this);}
            // else if(levelInd === NUM_LEVELS-1) {level = new EndScreen(sliceArr, this);}
            room = new Room(roomArr, this);
            this.rooms.push(room);
        });
        this.roomInd = 0;
        this.deaths = 0;

        this.screenShakeFrames = 0;

        const scoreBoardWidth = 44;
        this.scoreboardRect = new BMath.Rectangle(Graphics.CANVAS_SIZE[0]-scoreBoardWidth-8, 4, 44, 35);
        console.log(this.scoreboardRect.toString());
        this.scoreboardFrames = 90;
        this.cheated = false;
        this.emptySquareData = {x:-1, y:-1, rad:-1, color:null};
    }

    getCurrentRoom() {
        return this.rooms[this.roomInd];
    }

    drawCurrentRoom() {
        this.getCurrentRoom().drawAll();
        if(this.scoreboardFrames > 0) this.drawScoreboard();
        if(this.emptySquareData.x !== -1) {
            this.drawEmptySquareAround(
                this.emptySquareData.x,
                this.emptySquareData.y,
                this.emptySquareData.rad,
                this.emptySquareData.color,
            )
        }
        if(optionsCon.showing) {
            optionsCon.draw();
        }
    }

    setDrawEmptySquareData(x, y, rad, color) {
        this.emptySquareData = {x:x, y:y, rad:rad, color:color};
    }

    stopDrawEmptySquare() {this.emptySquareData.x = -1;}

    getPlayer() {return this.getCurrentRoom().getPlayer();}
    drawEmptySquareAround(x, y, r, color) {
        const xmr = x-r;
        const ypr = y+r;
        const rects = [
            new BMath.Rectangle(0, 0, xmr, CANVAS_SIZE[1]),
            new BMath.Rectangle(xmr, 0, 2*r, y-r),
            new BMath.Rectangle(xmr, ypr, 2*r, CANVAS_SIZE[1]-ypr),
            new BMath.Rectangle(x+r, 0, CANVAS_SIZE[0]-x-r, CANVAS_SIZE[1])
        ];
        rects.map(r => drawRectOnCanvas(r, color ? color : "black"));
    }
    drawScoreboard() {
        // const backgroundRect = new Rectangle(this.scoreboardRect.getX()-1, this.scoreboardRect.getY()-1, this.scoreboardRect.width+2, this.scoreboardRect.height+2);
        // drawOnCanvas(backgroundRect, "#7e2553");
        Graphics.drawRectOnCanvas(this.scoreboardRect, "#00000080", true);
        Graphics.writeText(this.formatTimeSinceStart(), 1, BMath.Vector({x:this.scoreboardRect.getX()+2, y:this.scoreboardRect.getY()+2}), this.cheated ? "#FF004D" : "#FFF1E8", 0, true);
        // CTX.drawImage(SKULL_IMG, this.scoreboardRect.getX()+1+this.cameraOffset.x, this.scoreboardRect.getY()+10+this.cameraOffset.y);
        Graphics.writeText(this.deaths.toString(), 1, BMath.Vector({x:this.scoreboardRect.getX()+10, y:this.scoreboardRect.getY()+11}), "#FFF1E8", 0, true);
        // if(!this.onLastLevel()) Graphics.writeText(`${this.roomInd}/${NUM_LEVELS-2}`, 1, BMath.Vector({x:this.scoreboardRect.getX()+2, y:this.scoreboardRect.getY()+20}), "#FFF1E8");
        // if(this.roomInd > 0 && this.roomInd < 19) {
        //     Graphics.writeText(SECRET_CODES[this.roomInd-1], 1, BMath.Vector({x:this.scoreboardRect.getX()+2, y:this.scoreboardRect.getY()+28}), "#FFF1E8");
        // }
    }

    setKeys(keys) {
        if(!optionsCon.showing) {
            if(keys["KeyO"]  === 2) {this.nextRoom();}
            if(keys["KeyP"]  === 2) {
                this.roomInd -= 1;
                this.getCurrentRoom().getPlayer().setX(10);
                this.getCurrentRoom().killPlayer();
            }
            if(keys["KeyC"]) {this.scoreboardFrames += 1;}
            this.getCurrentRoom().setKeys(keys);
        } else {
            optionsCon.setKeys(keys)
        }
        if(!this.prevEnter && keys["Enter"]) {optionsCon.toggleOptions();}
        this.prevEnter = keys["Enter"];
    }
    onLastLevel() {
        return this.roomInd + 1 === NUM_LEVELS;
    }
    update() {
        if(!optionsCon.showing) {
            this.getCurrentRoom().update();
            if(this.screenShakeFrames > 0) {
                this.shakeScreen();
            }
            if(this.scoreboardFrames > 0 && !this.onLastLevel()) {
                this.scoreboardFrames -= 1;
            }
        }
    }

    nextRoom() {
        this.setRoom(this.roomInd+1);
    }

    setRoom(ind) {
        this.roomInd = ind;
        if(this.roomInd > 0) {
            canvas.style.backgroundImage = 'url("images/Background.png")';
        }
        if(this.roomInd > 0 && this.roomInd < 11) {
            if(audioCon.curSong._src !== STAGE1_MUSIC._src && audioCon.curSong._src !== BEGINNING_MUSIC._src) {audioCon.playSong(STAGE1_MUSIC);}
            else {audioCon.queueSong(STAGE1_MUSIC);}
        } else if(this.roomInd > 10) {
            if(audioCon.curSong._src !== STAGE2_MUSIC._src) {audioCon.stopSong(); audioCon.playSong(STAGE2_MUSIC);}
            else {audioCon.queueSong(STAGE2_MUSIC);}
        }
        this.getCurrentRoom().resetStage();
        this.respawn();
        if(this.onLastLevel()) {
            this.scoreboardRect.pos = Vector({x: 46, y: 94});
            this.scoreboardRect.height = 20;
            const t = window.performance.now();
            this.nanosecondsSinceStart = () => {return t-this.startTime;};
            audioCon.fadeOutSong(750);
        }
    }

    formatTimeNs(ns) {return new Date(ns).toISOString().substr(11, 11)}
    nanosecondsSinceStart() {return window.performance.now()-this.startTime;}
    formatTimeSinceStart() {return this.formatTimeNs(this.nanosecondsSinceStart());}

    death() {
        this.deaths += 1;
        this.screenShakeFrames = 14;
        if(this.roomInd !== 0) this.spawnDusts(14);
    }

    startScreenShake() {
        if(this.screenShakeFrames === 0) {
            this.screenShakeFrames = 9;
            if(this.roomInd !== 0) this.spawnDusts(Math.random()*4+7);
        }
    }

    spawnDusts(numDusts) {
        for(let i = 0; i<numDusts; ++i) {
            const spawnX = Math.random()*CANVAS_SIZE[0];
            const curLevel = this.getCurrentRoom();
            const mult = Math.random()+3*3;
            const angleOffset = Math.random()*5;
            const dust = new BrownDust(Math.round(spawnX), Math.round(-5-Math.random()*50), Math.random()*3+0.5, new AnimatedSprite(
                BROWN_DUST_SPRITESHEET,
                null,
                [{"frames": 0, onComplete: null}, {"frames": 6, onComplete: null, nth: 10}]
            ),
                (frame) => {return Math.round(spawnX+(mult*Math.sin(frame/60*2*Math.PI+angleOffset)));},
                curLevel,
                );
            curLevel.pushDecoration(dust);
        }
    }

    shakeScreen() {
        this.screenShakeFrames -= 1;
        // this.cameraOffset.incrPoint(SCREEN_SHAKES[this.screenShakeFrames%8]);
        // canvas.style.backgroundPosition = `top ${this.cameraOffset.y*3}px left ${this.cameraOffset.x*2}px`;
    }

    endGame() {
        this.getCurrentRoom().endGame();
    }

    respawn() {this.scoreboardFrames = 90;}

    onStickyLevel() {
        return this.roomInd === 10;
    }

    checkCheatCode(cheatCode) {
        return SECRET_CODES.includes(cheatCode);
    }

    applyCheatCode(cheatCode) {
        const ind = SECRET_CODES.indexOf(cheatCode);
        if(ind !== -1) {
            this.cheated = true;
            this.setRoom(ind+1);
        }
    }
}

class PlayerKill extends Phys.Solid {
    constructor(x, y, w, h, level, direction) {
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
    constructor(x, y, w, h, room) {
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

let keys = {
    "ArrowRight": 0,
    "ArrowLeft": 0,
    "ArrowDown": 0,
    "ArrowUp": 0,
    "KeyZ": 0,
    "KeyX": 0,
    // "KeyO": 0,
    // "KeyP" : 0,
    "KeyC": 0,
    "KeyR" : 0,
    "Enter": 0,

    // "KeyA":0,
    // "KeyB":0,
    // "KeyD":0,
    // "KeyE":0,
    // "KeyF":0,
    // "Digit0":0,
    // "Digit1":0,
    // "Digit2":0,
    // "Digit3":0,
    // "Digit4":0,
    // "Digit5":0,
    // "Digit6":0,
    // "Digit7":0,
    // "Digit8":0,
    // "Digit9":0,
    // "Backspace":0,
};

let prevKeys = null;
const game = new Game(TILE_MAP);
// game.start();
function g() {
    //Set pressed keys to 2 instead of 1
    Object.keys(keys).map(key => {
        if(keys[key] === 1 && prevKeys[key] === 0) {
           keys[key] = 2;
        } else if(keys[key] === 2 && prevKeys[key] === 2) {
            keys[key] = 1;
        }
    });
    prevKeys = {...keys};
    Graphics.update();
    game.setKeys(keys);
    game.update();
    game.drawCurrentRoom();
    // if(game.animFrame%2 === 0) {
    //     Graphics.clearCanvas();
    //     game.setKeys(keys);
    //     game.update();
    //     game.drawCurrentRoom();
    //     game.animFrame-= 1;
    // }
    // game.animFrame+= 1;
}

function loadRoomData() {
    let rooms = [];
    fetch('./Levels/W0L0.json')
        .then(response => response.json())
        .then(
            rooms.push(data);
        );
}

let stopMain = null;
;(function () {
    function main() {
        stopMain = window.requestAnimationFrame(main);
        g();
        // Your main loop contents
    }

    loadRoomData();

    main(); // Start the cycle
})();

document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);

function keyDownHandler(event) {
    if(event.code in keys) {
        keys[event.code] = 1;
    }
}

function keyUpHandler(event) {
    if(event.code in keys) {keys[event.code] = 0;}
}

document.addEventListener('visibilitychange', function() {
    if(document.hidden) {
        optionsCon.showing = true;
    }
});