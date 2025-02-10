import nodemailer from 'nodemailer';
import { decrypt } from './encrypt.js';
import logger from './logger.js';

class Mailer {
  constructor(user) {
    this.user = user;
  }

  createTransporter() {
    try {
      let password = decrypt(this.user.appPassword);
      this.transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
          user: this.user.email,
          pass: password
        },
        tls: {
          ciphers: 'SSLv3'
        }
      });
    } catch (error) {
      logger.error('Error creating mailer:', error);
    }
  }

  verify() {
    return new Promise((resolve, reject) => {
      this.transporter.verify(function (error, success) {
        if (error) {
          logger.error('Error verifying mailer:', error);
          resolve(false);
        } else {
          logger.debug('Server is ready to take our messages');
          resolve(true);
        }
      });
    });
  }

  async sendMail(to, adminsCC, subject, text) {
    if (await this.verify()) {
      try {
        const ccEmails = adminsCC.filter(admin => admin.email !== this.user.email).map(admin => admin.email).join(', ');
        const mailOptions = {
          from: this.user.email,
          to: to,
          cc: ccEmails,
          subject: subject,
          text: text
        };
        let info = await this.transporter.sendMail(mailOptions);
        logger.info(`Email sent: ${to} - ${info.messageId}`);
        logger.audit(`Email sent: ${to} - ${info.messageId} by ${this.user.firstName} ${this.user.lastName}`);
      } catch (error) {
        logger.error('Error sending email: ' + error);
        logger.error('Error details:', error.response);
      }
    }
  }
}

export async function mailHandler(user, to, adminsCC, subject, text) {
  let mailer = new Mailer(user);
  if (!user.mailsEnabled) {
    return;
  }
  mailer.createTransporter();
  await mailer.sendMail(to, adminsCC, subject, text);
}

export async function verifyPassword(user, password) {
  let mailer = new Mailer(user);
  mailer.user.appPassword = password;
  mailer.createTransporter();
  return await mailer.verify();
}
export default Mailer;