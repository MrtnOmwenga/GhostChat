import React from 'react';
import { Link } from 'react-router-dom';
import style from './Home.module.css';
import masks from '../../assets/images/masks.svg';
import disposableImage from '../../assets/images/disposable.jpg';
import roomsImage from '../../assets/images/rooms.jpeg';
import Nav from './Nav';

const FEATURES = [
  { title: 'End-to-end encrypted', text: 'Messages are encrypted in your browser and decrypted in theirs. The server stores ciphertext it cannot read.' },
  { title: 'Signed and chained', text: 'Every message is signed by its author and linked to the one before. The server checks both before storing it, and your browser checks them again.' },
  { title: 'Your keys, any device', text: 'Keys live in a vault only your password opens. Sign in anywhere; lose the password and your recovery phrase brings you back.' },
  { title: 'Real-time and present', text: 'Messages arrive instantly, contacts show when they are online, and history is there after a reload.' },
];

const FAQ = [
  {
    question: 'How anonymous is GhostChat really?',
    answer: 'Your account is a username and a password: no email, phone number or real name. Nothing ties it to you unless you put it there.',
  },
  {
    question: 'Can the server read my messages?',
    answer: 'No. Your browser encrypts each message before sending it, and only the people in the conversation hold the keys to decrypt it. The server stores and relays ciphertext. It still sees who talks to whom and when.',
  },
  {
    question: 'What happens when I delete my account?',
    answer: 'Your account, keys and every message you sent are erased, and you are signed out everywhere. Your messages leave a "deleted" marker so the conversation\'s chain still verifies. Rooms you were in replace their key.',
  },
  {
    question: 'How are rooms protected?',
    answer: 'You join through an invite link whose secret never reaches the server. Each room has its own key, replaced whenever someone leaves, and a fingerprint members can compare.',
  },
  {
    question: 'What if I forget my password?',
    answer: 'The 24-word recovery phrase you wrote down at sign-up restores your account. Without the password and the phrase, nobody can recover it, including GhostChat: that is what makes the encryption real.',
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
        <p className={style.tagline}>End-to-end encrypted. Disposable accounts. No personal details.</p>
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
            <h2>Private rooms, joined by invite</h2>
            <p>
              Create a room and share an invite link. Its secret never touches the server, every
              room key is encrypted for its members only, and everyone sees when someone joins.
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
