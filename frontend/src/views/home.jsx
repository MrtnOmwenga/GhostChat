import React from 'react';
import { Link } from 'react-router-dom';
import style from '../assets/style/home.module.css';
import masks from '../assets/1f3ad.svg';
import disposableImage from '../assets/home_image3.jpg';
import roomsImage from '../assets/home_image2.jpeg';
import Nav from '../components/nav.component';

const Home = () => (
  <div className={style.home} id="top">
    <Nav />
    <main>
      <section className={style.hero} aria-labelledby="hero-title">
        <div className={style.stage}>
          <span className={`${style.corner} ${style.topLeft} ${style.brandWord}`}>GhostChat</span>
          <span className={`${style.corner} ${style.topRight}`}>Anonymity</span>
          <span className={`${style.corner} ${style.bottomLeft}`}>Mystery</span>
          <span className={`${style.corner} ${style.bottomRight}`}>Freedom</span>
          <div className={style.art}>
            <img src={masks} alt="" className={style.masks} />
            <h1 id="hero-title" className={style.discover}>Discover</h1>
          </div>
        </div>
        <p className={style.tagline}>Disposable accounts. Private rooms. No personal details.</p>
        <Link to="/login-register" className={style.cta}>Start messaging</Link>
      </section>

      <section id="features" className={style.features}>
        <article className={style.feature}>
          <div className={style.featureText}>
            <h2>Disposable accounts, vanish without a trace</h2>
            <p>
              Sign up with a username and a password, nothing else. When you&apos;re done, delete the
              account and it&apos;s gone.
            </p>
          </div>
          <img src={disposableImage} alt="" className={style.featureImage} loading="lazy" />
        </article>
        <article className={`${style.feature} ${style.reverse}`}>
          <div className={style.featureText}>
            <h2>Private, password-protected rooms</h2>
            <p>
              Create a room, share its name and password with the people you want in it, and talk in a
              dark, quiet interface built for conversation.
            </p>
          </div>
          <img src={roomsImage} alt="" className={style.featureImage} loading="lazy" />
        </article>
      </section>

      <section id="faq" className={style.faq}>
        <h2>Mysterious queries, unveiled answers</h2>
        <div className={style.faqGrid}>
          <div>
            <h3>How anonymous is GhostChat really?</h3>
            <p>
              Your account is just a username and a password: no email, phone number or real name.
              Messages travel over HTTPS; end-to-end encryption is on the way.
            </p>
          </div>
          <div>
            <h3>Do I need to provide personal info?</h3>
            <p>
              No. Pick any username that isn&apos;t taken and start talking. Nothing ties it to you
              unless you put it there.
            </p>
          </div>
        </div>
      </section>

      <section className={style.join}>
        <h2>Join the enigma</h2>
        <Link to="/login-register" className={style.ctaDark}>Create an account</Link>
      </section>
    </main>
    <footer className={style.footer}>
      <span>GhostChat</span>
      <a href="https://github.com/MrtnOmwenga/GhostChat">Source on GitHub</a>
    </footer>
  </div>
);

export default Home;
