const { Howl } = require("howler");

function playSound(filePath) {
  const sound = new Howl({
    src: [filePath],
    html5: true,
    volume: 1.0,
  });
  sound.play();
}

module.exports = { playSound };
