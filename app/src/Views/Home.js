import React from 'react';
import style from '../Assets/Style/Home.module.css';
import background from '../Assets/1f3ad.svg';
import HomeImage1 from '../Assets/home_image2.jpeg';
import HomeImage2 from '../Assets/home_image3.jpg';
import SubscribeForm from '../Components/SubscribeForm';
import Nav from '../Components/Nav';
// import HomeImage3 from '../Assets/home_image3.png';

/**
 * The above code is a React component that renders a home page for the website GhostChat, which
 * promotes anonymity and privacy in online chat rooms.
 */
const Home = () => (
  <div className={style.home}>
    <Nav />
    <div className={style.body}>
      <section className={style.section_a}>
        <div className={style.container}>
          <div className={style.div}>
            <div className={`${style.div} ${style.t1}`}>
              <p className={style.text}>AnonyChat</p>
            </div>
            <div className={`${style.div} ${style.t2}`}>
              <p className={style.text}>Anonymity</p>
            </div>
            <div className={`${style.div} ${style.t3}`}>
              <p className={style.text}>Mystery</p>
            </div>
            <div className={`${style.div} ${style.t4}`}>
              <p className={style.text}>Freedom</p>
            </div>
            <div className={style.main}>
              <h1>DISCOVER</h1>
            </div>
          </div>
          <div>
            <img className={style.background} src={background} alt="anonymous" loading="lazy" />
          </div>
        </div>
      </section>

      <section className={style.section_b}>
        <div className={style.section__b}>
          <div className={style.container_a}>
            <div className={style.text_container}>
              <h1> Disposable Accounts, Vanish Without a Trace </h1>
              <p>
                {' '}
                AnonyChat provides users with disposable accounts ensuring
                that the user experience is tailored around anonymity, because
                who needs a traceable online footprint?
                {' '}
              </p>
            </div>
            <div className={style.image_container}>
              <img src={HomeImage2} alt="Image1" loading="lazy" />
            </div>
          </div>
          <div className={style.container_b}>
            <div className={style.image_container}>
              <img src={HomeImage1} alt="Image2" loading="lazy" />
            </div>
            <div className={style.text_container}>
              <h1> Secure, Private, and Unique Chat Rooms </h1>
              <p>
                {' '}
                Chat in style through a dark, modern, and mysterious
                interface. Get ready to delve into the depths where no identity is concealed.
                {' '}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className={style.section_c}>
        <div>
          <h1> Mysterious Queries, Unveiled Answers </h1>
          <div>
            <div className={style.text_container}>
              <h5> How anonymous is AnonyChat really? </h5>
              <p>
                {' '}
                AnonyChat’s main objective is to maintain the anonymity of its users.
                With disposable accounts and secure messaging, rest assured that your
                privacy is our priority
              </p>
            </div>
            <div className={style.text_container}>
              <h5> Do I need to provide personal info? </h5>
              <p>
                {' '}
                Nope, you don’t need to provide any personal information! Just dive
                into the mysterious world of anonymous connections without any strings attached.
                {' '}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className={style.section_d}>
        <div className={style.container}>
          <h1> JOIN THE ENIGMA </h1>
          <SubscribeForm />
        </div>
      </section>
    </div>
  </div>
);

export default Home;
