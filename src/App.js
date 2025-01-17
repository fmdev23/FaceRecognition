import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { Howl } from 'howler';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import '@tensorflow/tfjs-backend-webgl'
import soundURL from './asset/beep.mp3';
import { initNotifications, notify } from '@mycv/f8-notification';

var sound = new Howl({
  src: [soundURL]
});

const NOT_TOUCH_LABEL = 'not_touch';
const TOUCHED_LABEL = 'touched';
const TRAINING_TIMES = 50;
const TOUCH_CONFIDENCE = 0.8;

function App() {
  // TRAINING_TIMES
  const [touched, setTouched] = useState(false)
  const video = useRef();
  const classifier = useRef();
  const canPlaySound = useRef(true);
  const mobilenetModule = useRef();

  const init = async () => {
    console.log('init...')
    await setupCamera();

    console.log('setup camera success')

    mobilenetModule.current = await mobilenet.load();
    classifier.current = knnClassifier.create();
    console.log('setup done');
    console.log('không chạm tay lên mặt và bấm Train 1');
    initNotifications({ cooldown: 3000 });
  }

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream;
            video.current.addEventListener('loadeddata', resolve)
          },
          error => reject(error)
        )
      } else {
        reject();
      }
    });
  }

  const train = async label => {
    console.log(`[${label}] Đang train cho máy`)
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      console.log(`Progress ${parseInt((i + 1) / TRAINING_TIMES * 100)}%`);

      await training(label);
    }

  }

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobilenetModule.current.infer(
        video.current,
        true
      );
      classifier.current.addExample(embedding, label);
      await sleep(100);
      resolve();
    })
  }

  const run = async () => {
    const embedding = mobilenetModule.current.infer(
      video.current,
      true
    );
    const result = await classifier.current.predictClass(embedding);


    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCH_CONFIDENCE
    ) {
      console.log('touched');
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }
      notify('Bỏ tay ra', { body: 'Bạn vừa chạm tay vào mặt' });
      setTouched(true);
    } else {
      console.log('not touch');
      setTouched(false);
    }

    await sleep(200);
    run();
  }

  const sleep = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  useEffect(() => {
    init();

    sound.on('end', function () {
      canPlaySound.current = true;

    });

    return () => {

    }
    //eslint-disable-next-line react-hooks/exhaustive-ddeps
  }, []);

  return (
    <div className={`main ${touched ? 'touched' : ''}`}>
      <video
        ref={video}
        className="video"
        autoPlay
      />

      <div className="control">
        <button className="btn" onClick={() => train(NOT_TOUCH_LABEL)}>Train 1</button>
        <button className="btn" onClick={() => train(TOUCHED_LABEL)}>Train 2</button>
        <button className="btn" onClick={() => run()}>Run</button>
      </div>
    </div>
  );
}


export default App;
