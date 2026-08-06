import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: Number(this.configService.get('MAIL_PORT')),
      secure: Number(this.configService.get('MAIL_PORT')) === 465,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
    // this.transporter
    //   .verify()
    //   .then(() => {
    //     this.logger.log('SMTP Connected');
    //   })
    //   .catch((err) => {
    //     this.logger.error('SMTP Connection Failed');
    //     this.logger.error(err);
    //   });
  }

  private compileTemplate(
    templateName: string,
    data: Record<string, any>,
  ): string {
    const templatePath = path.join(
      process.cwd(),
      'libs',
      'notification',
      'src',
      'email',
      'templates',
      `${templateName}.hbs`,
    );
    const source = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(source);
    return template(data);
  }

  async sendOtp(email: string, otp: string) {
    // this.logger.log(`Sending OTP ${otp} to ${email}`);

    const html = this.compileTemplate('otp', { otp, expiry: 5 });
    await this.sendEmail(email, 'OTP Verification', html);

    // return true;
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM'),
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed sending email to ${to}`);
      this.logger.error(error);
      throw error;
    }
    // this.logger.log(`Sending Email`);

    // this.logger.log({
    //   to,
    //   subject,
    //   html,
    // });

    // return true;
  }
}
