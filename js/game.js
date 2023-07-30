let game;

const gameOptions = {
  playerSpeed: 300,
  playerSize: 50,
};

window.onload = function () {
  let gameConfig = {
    type: Phaser.AUTO,
    backgroundColor: "#f0f0f0",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1000,
      height: 1000,
    },
    pixelArt: true,
    physics: {
      default: "arcade",
      arcade: {},
    },
    scene: PlayLevels,
  };

  game = new Phaser.Game(gameConfig);
  window.focus();
};

class PlayLevels extends Phaser.Scene {
  constructor() {
    super("PlayLevels");
    this.coinScore = 0; // total coins collected
    this.levelScore = 0; // total levels complited
    this.numOfLevels = 6; // total number of levels. There's propably a smarter way of doing this something like scandir()
    this.isLoaded = false; // whether or not game is loaded
    this.doInput = false; // whether or not to read user input
  }

  preload() {
    this.load.image("blue", "assets/blue.png");
    this.load.image("blueBucket", "assets/blueBucket.png");
    this.load.image("coin", "assets/coin.png");
    this.load.image("gray", "assets/gray.png");
    this.load.image("green", "assets/green.png");
    this.load.image("key", "assets/key.png");
    this.load.image("lock", "assets/lock.png");
    this.load.image("open", "assets/open.png");
    this.load.image("red", "assets/red.png");
    this.load.image("redBucket", "assets/redBucket.png");
    this.load.image("yellow", "assets/yellow.png");
    this.load.image("yellowBucket", "assets/yellowBucket.png");
    this.load.image("spaghetti", "assets/spaghetti.png");
  }

  create() {
    this.wallGroup = this.physics.add.group({ immovable: true });
    this.dangerGroup = this.physics.add.group({ immovable: true });
    this.coinGroup = this.physics.add.group({ immovable: true });
    this.bucketGroup = this.physics.add.group({ immovable: true });

    this.dialogueGroup = this.physics.add.group({ immovable: true });

    this.projectileGroup = this.physics.add.group({ immovable: true });
    this.bossBarGroup = this.physics.add.group({ immovable: true });

    // add a group so that every moving object can easily be stopped
    this.movingGroup = this.physics.add.group({});

    // add a UI group so they can be set to be on top of everything else
    this.uiGroup = this.physics.add.group({});

    // add coin counter
    this.uiGroup.create(25, 25, "coin").setOrigin(0);
    this.coinScoreText = this.add.text(75, 35, "0", { fontSize: "40px", fill: "#ffffff" });
    this.uiGroup.add(this.coinScoreText);

    this.cursors = this.input.keyboard.createCursorKeys();

    this.startLevel();
  }

  endLevel() {
    // stop reading input
    this.doInput = false;
    this.isLoaded = false;

    // iterates levelScore
    this.levelScore++;

    // clear objects
    this.clearObjects();

    // calls startLevel
    this.startLevel();
  }

  startLevel() {
    // update coin counter
    this.updateCoinScoreText();

    // load level from file
    fetch("./levels/" + this.levelScore + ".json")
      .then((res) => res.json())
      .then((levelData) => {
        // create walls
        levelData.walls.forEach((wall) => {
          this.wallGroup
            .create(wall.x0, wall.y0, "gray")
            .setOrigin(0)
            .setScale(wall.x1 - wall.x0, wall.y1 - wall.y0);
        });

        // skip creating rest of level if it is the final level or the one after
        if (this.levelScore + 1 < this.numOfLevels) {
          // create coins
          levelData.coins.forEach((coin) => {
            this.coinGroup.create(coin.x, coin.y, "coin").setOrigin(0);
          });

          // create buckets
          levelData.buckets.forEach((bucket) => {
            this.bucketGroup
              .create(bucket.x, bucket.y, bucket.colour + "Bucket")
              .setOrigin(0)
              .setData({ colour: bucket.colour });
          });

          // create dangers
          levelData.dangers.forEach((danger) => {
            this.dangerGroup
              .create(danger.pos[0].x, danger.pos[0].y, danger.colour)
              .setOrigin(0)
              .setScale(danger.w, danger.h)
              .setData({
                pos: danger.pos,
                speed: danger.speed,
                colour: danger.colour,
                target: 1,
                updateMovement(thisDanger, scene) {
                  // only move if there is more than 1 given pos
                  if (thisDanger.data.values.pos.length > 1) {
                    // update the target pos
                    let distancePerUpdate = thisDanger.data.values.speed / 60;
                    if (
                      Phaser.Math.Distance.Between(
                        thisDanger.data.values.pos[thisDanger.data.values.target].x,
                        thisDanger.data.values.pos[thisDanger.data.values.target].y,
                        thisDanger.x,
                        thisDanger.y
                      ) <=
                      distancePerUpdate / 2
                    ) {
                      // set coords to the target
                      thisDanger.x = thisDanger.data.values.pos[thisDanger.data.values.target].x;
                      thisDanger.y = thisDanger.data.values.pos[thisDanger.data.values.target].y;
                      if (++thisDanger.data.values.target >= thisDanger.data.values.pos.length) {
                        thisDanger.data.values.target = 0;
                      }
                    }

                    scene.physics.moveTo(
                      thisDanger,
                      thisDanger.data.values.pos[thisDanger.data.values.target].x,
                      thisDanger.data.values.pos[thisDanger.data.values.target].y,
                      thisDanger.data.values.speed
                    );
                  }
                },
              });
          });

          // add dangers to moving group
          this.dangerGroup.getChildren().forEach((danger) => {
            this.movingGroup.add(danger);
          });

          // create key
          this.key = this.physics.add.image(levelData.keyX, levelData.keyY, "key").setOrigin(0);

          // create door;
          this.lock = this.physics.add.image(levelData.doorX, levelData.doorY, "lock").setOrigin(0);
        }

        // create player and add it to movingGroup
        this.player = this.physics.add
          .image(levelData.spawnX, levelData.spawnY, levelData.playerColour)
          .setScale(gameOptions.playerSize, gameOptions.playerSize)
          .setOrigin(0)
          .setData({
            colour: levelData.playerColour,
          });
        this.movingGroup.add(this.player);

        // add colliders and overlaps
        this.physics.add.collider(this.player, this.wallGroup);

        this.physics.add.overlap(this.player, this.dangerGroup, this.hitDanger, null, this);
        this.physics.add.overlap(this.player, this.projectileGroup, this.hitDanger, null, this);
        this.physics.add.overlap(this.player, this.coinGroup, this.collectCoin, null, this);
        this.physics.add.overlap(this.player, this.bucketGroup, this.collectBucket, null, this);
        this.physics.add.overlap(this.player, this.key, this.collectKey, null, this);

        // if it is the final level, initialise the boss fight
        if (this.levelScore + 1 == this.numOfLevels) {
          this.initBossFight();
        }

        this.isLoaded = true;

        // this is the first level, do beginningCutscene
        if (this.levelScore == 0) {
          this.beginningCutscene(levelData.textBox);
        }

        // if this is the post-victory level, do endingCutscene
        if (this.levelScore == this.numOfLevels) {
          this.endingCutscene(levelData.spaghetti, levelData.textBox);
        }

        // give player time to react to level changing and begin reading input
        this.time.delayedCall(500, () => (this.doInput = true), [], this);
      });
  }

  collectCoin(player, coin) {
    coin.destroy();
    this.coinScore += 1;
    this.updateCoinScoreText();
  }

  collectBucket(player, bucket) {
    player.data.values.colour = bucket.data.values.colour;
    player.setTexture(player.data.values.colour);
  }

  collectKey(player, key) {
    key.destroy();
    this.door = this.physics.add.image(this.lock.x, this.lock.y, "open").setOrigin(0);
    this.physics.add.overlap(this.player, this.door, this.endLevel, null, this);
    this.lock.destroy();
  }

  // create hitDanger
  hitDanger(player, danger) {
    if (player.data.values.colour !== danger.data.values.colour) {
      this.gameOver();
    }
  }

  // create gameOver
  gameOver() {
    this.doInput = false;
    this.isLoaded = false;
    this.stopMovement();
    this.clearObjects();
    this.levelScore = 0;
    this.coinScore = 0;
    this.startLevel();
  }

  stopMovement() {
    this.movingGroup.getChildren().forEach((obj) => {
      obj.body.velocity.x = 0;
      obj.body.velocity.y = 0;
    });
  }

  updateCoinScoreText() {
    this.coinScoreText.setText(this.coinScore);
  }

  clearObjects() {
    // clears groups and unique objects
    this.wallGroup.clear({
      removeFromScene: true,
      destroyChildren: true,
    });
    this.dangerGroup.clear({
      removeFromScene: true,
      destroyChildren: true,
    });
    this.coinGroup.clear({
      removeFromScene: true,
      destroyChildren: true,
    });
    this.bucketGroup.clear({
      removeFromScene: true,
      destroyChildren: true,
    });
    this.dialogueGroup.clear({
      removeFromScene: true,
      destroyChildren: true,
    });
    this.projectileGroup.clear({
      removeFromScene: true,
      destroyChildren: true,
    });
    this.bossBarGroup.clear({
      removeFromScene: true,
      destroyChildren: true,
    });
    if (typeof this.key != "undefined") {
      this.key.destroy();
    }
    if (typeof this.lock != "undefined") {
      this.lock.destroy();
    }
    if (typeof this.door != "undefined") {
      this.door.destroy();
    }
    if (typeof this.player != "undefined") {
      this.player.destroy();
    }
    if (typeof this.boss != "undefined") {
      this.boss.destroy();
    }
  }

  // create update
  update() {
    if (this.isLoaded) {
      // bring ui to top
      this.uiGroup.getChildren().forEach((ui) => {
        this.children.bringToTop(ui);
      });
      if (this.doInput) {
        if (this.cursors.right.isDown && this.cursors.left.isDown) {
          this.player.body.velocity.x = 0;
        } else if (this.cursors.left.isDown) {
          this.player.body.velocity.x = -gameOptions.playerSpeed;
        } else if (this.cursors.right.isDown) {
          this.player.body.velocity.x = gameOptions.playerSpeed;
        } else {
          this.player.body.velocity.x = 0;
        }

        if (this.cursors.up.isDown && this.cursors.down.isDown) {
          this.player.body.velocity.y = 0;
        } else if (this.cursors.down.isDown) {
          this.player.body.velocity.y = gameOptions.playerSpeed;
        } else if (this.cursors.up.isDown) {
          this.player.body.velocity.y = -gameOptions.playerSpeed;
        } else {
          this.player.body.velocity.y = 0;
        }
      } else {
        // stop player if input is not being read
        this.player.body.velocity.x = 0;
        this.player.body.velocity.y = 0;
      }

      // update danger movement
      this.dangerGroup.getChildren().forEach((danger) => {
        danger.data.values.updateMovement(danger, this);
      });

      // if it is the last level, doBossAction
      if (this.levelScore + 1 == this.numOfLevels) {
        if (++this.bossActionCounter >= 60 && this.boss.data.values.hp > 0) {
          this.bossActionCounter = 0;
          this.shootBossProjectile();
        }
      }
    } else {
      this.stopMovement();
    }
  }

  beginningCutscene(textBox) {
    this.dialogueRect = this.add
      .rectangle(textBox.x0, textBox.y0, textBox.x1 - textBox.x0, textBox.y1 - textBox.y0, textBox.colour)
      .setOrigin(0)
      .setDepth(1);

    this.dialogueText = this.add
      .text(textBox.x0 + textBox.margin, textBox.y0 + textBox.margin, "Man, if only\nI had some\nspaghetti", { fontSize: "50px", fill: "#000000" })
      .setDepth(2);

    this.dialogueGroup.add(this.dialogueRect);
    this.dialogueGroup.add(this.dialogueText);
  }

  endingCutscene(spaghetti, textBox) {
    this.dialogueSpaghetti = this.add
      .image(spaghetti.x0, spaghetti.y0, "spaghetti")
      .setOrigin(0)
      .setScale(
        (spaghetti.x1 - spaghetti.x0) / this.textures.get("spaghetti").get().width,
        (spaghetti.y1 - spaghetti.y0) / this.textures.get("spaghetti").get().height
      );

    this.dialogueRect = this.add
      .rectangle(textBox.x0, textBox.y0, textBox.x1 - textBox.x0, textBox.y1 - textBox.y0, textBox.colour)
      .setOrigin(0)
      .setDepth(1);

    this.dialogueText = this.add.text(textBox.x0 + textBox.margin, textBox.y0 + textBox.margin, "Nice", { fontSize: "50px", fill: "#000000" }).setDepth(2);

    this.dialogueGroup.add(this.dialogueSpaghetti);
    this.dialogueGroup.add(this.dialogueRect);
    this.dialogueGroup.add(this.dialogueText);
  }

  // everything beyond this line is used only for the last level
  initBossFight() {
    this.bossActionCounter = -60;
    this.createBoss();
  }

  createBoss() {
    fetch("levels/boss.json")
      .then((res) => res.json())
      .then((bossData) => {
        this.boss = this.physics.add
          .image(bossData.x0, bossData.y0, bossData.texture, { immovable: true })
          .setScale(
            (bossData.x1 - bossData.x0) / this.textures.get(bossData.texture).get().width,
            (bossData.y1 - bossData.y0) / this.textures.get(bossData.texture).get().height
          )
          .setOrigin(0)
          .setData({
            hp: bossData.bossHP,
            projectileChance: bossData.projectileChance,
            projectileSpeed: bossData.projectileSpeed,
            projectileSize: bossData.projectileSize,
            projectileWarningTime: bossData.projectileWarningTime,
            roomWallThickness: bossData.roomWallThickness,
          });
        this.wallGroup.add(this.boss); // as far I know there isn't a way to make an image both impassable and immovable without it being in a group

        for (let i = 0; i < bossData.bossHP; i++) {
          this.bossBarGroup
            .create(bossData.bossBar.x0 + (i * (bossData.bossBar.x1 - bossData.bossBar.x0)) / bossData.bossHP, bossData.bossBar.y0, bossData.bossBar.colour)
            .setOrigin(0)
            .setScale((bossData.bossBar.x1 - bossData.bossBar.x0) / bossData.bossHP, bossData.bossBar.y1 - bossData.bossBar.y0);
        }

        this.physics.add.overlap(this.boss, this.projectileGroup, this.bossProjectileDamage, null, this);
      });
  }

  bossProjectileDamage(boss, projectile) {
    if (projectile.data.values.damageBoss) {
      projectile.data.values.damageBoss = false;
      let bossBarSegment = this.bossBarGroup.getLast(true);
      if (bossBarSegment != null) {
        bossBarSegment.destroy();
      }
      if (--boss.data.values.hp <= 0) {
        this.finishGame();
      }
    }
  }

  shootBossProjectile() {
    if (this.isLoaded && typeof this.boss != "undefined") {
      this.doingBossAction;
      if (this.boss.data.values.projectileChance > Math.floor(Math.random() * 100)) {
        let projectileColour;
        const colourInt = Math.floor(Math.random() * 3);
        if (colourInt == 0) {
          projectileColour = "red";
        } else if (colourInt == 1) {
          projectileColour = "blue";
        } else if (colourInt == 2) {
          projectileColour = "yellow";
        }

        let projectile = this.physics.add
          .image(
            Math.floor(
              Math.random() * (1000 - this.boss.data.values.roomWallThickness * 2 - this.boss.data.values.projectileSize) +
                this.boss.data.values.roomWallThickness
            ),
            1000 - this.boss.data.values.projectileSize - this.boss.data.values.roomWallThickness,
            projectileColour
          )
          .setOrigin(0)
          .setScale(this.boss.data.values.projectileSize, this.boss.data.values.projectileSize)
          .setData({ colour: projectileColour, damageBoss: true });
        this.projectileGroup.add(projectile);
        this.movingGroup.add(projectile);
        this.physics.moveTo(projectile, this.player.x, this.player.y, this.boss.data.values.projectileSpeed);
      }
    }
  }

  finishGame() {
    this.isLoaded = false;
    this.doInput = false;
    this.stopMovement();

    setTimeout(() => {
      this.boss.setTexture("open");
      this.wallGroup.remove(this.boss); // remove boss from wallGroup
      this.projectileGroup.clear({ removeFromScene: true, destroyChildren: true });
      this.playerBossCollider = this.physics.add.overlap(this.player, this.boss, this.endLevel, null, this);
      setTimeout(() => {
        this.isLoaded = true;
        this.doInput = true;
      }, 500);
    }, 100);
  }
}
