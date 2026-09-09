# Machine Guardian

chat we are going to work together to develop and implement an application for monitoring some machines



we going to create an SCADA application, this time we not goint to use Factory Talk, we going to design together this apllication to run local on my pc.

here is the reference of linkedin of some surveilance application such as the one i want to develop

https://www.linkedin.com/feed/update/urn:li:activity:7449781099540611072/?updateEntityUrn=urn%3Ali%3Afs_updateV2%3A%28urn%3Ali%3Aactivity%3A7449781099540611072%2CFEED_DETAIL%2CEMPTY%2CDEFAULT%2Cfalse%29



i thought in use node-red to accquire and treat all data, a mosquitto server to connect the data, and a sql server to generate backlog.



Besides this. this will be an integrated maintence software. we are going to register start and end of the shift. All the stopped time and the reason if it was planned or because a failure and so on. we are going o discuss this later

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://leosamaintenance.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/30beff7e-0867-4e90-845e-d3174e9683ed).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
