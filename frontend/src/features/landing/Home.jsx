import React from 'react';
import { Link } from 'react-router-dom';
import style from './Home.module.css';
import masks from '../../assets/images/masks.svg';
import disposableImage from '../../assets/images/disposable.jpg';
import roomsImage from '../../assets/images/rooms.jpeg';
import Nav from './Nav';

const FEATURES = [
  { title: 'Real-time messaging', text: 'Messages arrive instantly over a WebSocket, one to one or in rooms.' },
  { title: 'Know who is around', text: 'Contacts show as online while they have GhostChat open, in any tab.' },
  { title: 'History that stays', text: 'Close the tab or reload: the last 100 messages of each conversation are waiting.' },
  { title: 'Built to be hard to abuse', text: 'Sessions in httpOnly cookies, hashed passwords, and rate limits on sign-in and messages.' },
];

const FAQ = [
  {
    question: 'How anonymous is GhostChat really?',
    answer: 'Your account is a username and a password: no email, phone number or real name. Nothing ties it to you unless you put it there.',
  },
  {
    question: 'Can the server read my messages?',
    answer: 'Today, yes: messages are stored so your history survives a reload, and they travel over HTTPS. End-to-end encryption is next, after which the server will only hold text it cannot read.',
  },
  {
    question: 'What happens when I delete my account?',
    answer: 'Your account, every message you sent and your room memberships are deleted, and you are signed out everywhere. Rooms you were alone in go too; rooms with other members pass to one of them.',
  },
  {
    question: 'How are rooms protected?',
    answer: 'Joining a room takes its exact name and password. Only members can read its history or post in it, and membership is checked on every message.',
  },
  {
    question: 'Is my history kept forever?',
    answer: 'Messages stay until you delete your account. Each conversation loads its latest 100 messages.',
  },
  {
    question: 'Do I need to provide personal info?',
    answer: 'No. Pick any username that isn\'t taken and start talking.',
  },
];

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
              account: it goes, and so does every message you sent.
            </p>
          </div>
          <img src={disposableImage} alt="" className={style.featureImage} loading="lazy" />
        </article>
        <article className={`${style.feature} ${style.reverse}`}>
          <div className={style.featureText}>
            <h2>Private, password-protected rooms</h2>
            <p>
              Create a room, share its name and password with the people you want in it, and talk.
              Only members can read or post, and everyone sees when someone new joins.
            </p>
          </div>
          <img src={roomsImage} alt="" className={style.featureImage} loading="lazy" />
        </article>
        <ul className={style.cards}>
          {FEATURES.map(({ title, text }) => (
            <li key={title} className={style.card}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="faq" className={style.faq}>
        <h2>Mysterious queries, unveiled answers</h2>
        <dl className={style.faqGrid}>
          {FAQ.map(({ question, answer }) => (
            <div key={question}>
              <dt>{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
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
