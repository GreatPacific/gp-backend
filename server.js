const https = require('https');
const http = require('http');
const nodemailer = require('nodemailer');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Great Pacific Travels AI Planner is running!' }));
    return;
  }

  // Generate itinerary
  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const messages = parsed.messages;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'API key not configured' } }));
          return;
        }

        const payload = JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: messages
        });

        const options = {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const apiReq = https.request(options, (apiRes) => {
          let data = '';
          apiRes.on('data', chunk => data += chunk.toString());
          apiRes.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        apiReq.on('error', (e) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: e.message } }));
        });

        apiReq.write(payload);
        apiReq.end();

      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: e.message } }));
      }
    });
    return;
  }

  // Send enquiry emails
  if (req.method === 'POST' && req.url === '/enquiry') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { name, email, phone, answers, itinerary } = JSON.parse(body);

        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'mail.greatpacifictravels.com.au',
          port: parseInt(process.env.EMAIL_PORT) || 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        // Email to Great Pacific Travels team
        const teamEmail = {
          from: process.env.EMAIL_USER,
          to: process.env.AGENT_EMAIL || process.env.EMAIL_USER,
          subject: `🌏 New Travel Enquiry from ${name} — ${answers.destination || 'Dream Trip'}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#0F2340;padding:20px;border-radius:10px 10px 0 0">
                <h1 style="color:#fff;margin:0;font-size:22px">🌏 New Travel Enquiry</h1>
                <p style="color:#9FE1CB;margin:5px 0 0">Great Pacific Travels — AI Trip Planner</p>
              </div>
              
              <div style="background:#f8f9fa;padding:20px;border-radius:0 0 10px 10px">
                
                <h2 style="color:#0F2340;border-bottom:2px solid #1D9E75;padding-bottom:8px">👤 Customer Details</h2>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px;font-weight:bold;color:#444;width:140px">Name:</td><td style="padding:8px;color:#222">${name}</td></tr>
                  <tr style="background:#fff"><td style="padding:8px;font-weight:bold;color:#444">Email:</td><td style="padding:8px;color:#222"><a href="mailto:${email}">${email}</a></td></tr>
                  <tr><td style="padding:8px;font-weight:bold;color:#444">Phone:</td><td style="padding:8px;color:#222">${phone || 'Not provided'}</td></tr>
                </table>

                <h2 style="color:#0F2340;border-bottom:2px solid #1D9E75;padding-bottom:8px;margin-top:24px">✈️ Trip Details</h2>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px;font-weight:bold;color:#444;width:140px">Destination:</td><td style="padding:8px;color:#222">${answers.destination || 'Not specified'}</td></tr>
                  <tr style="background:#fff"><td style="padding:8px;font-weight:bold;color:#444">Duration:</td><td style="padding:8px;color:#222">${answers.duration || 'Not specified'}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold;color:#444">Travellers:</td><td style="padding:8px;color:#222">${answers.travellers || 'Not specified'}</td></tr>
                  <tr style="background:#fff"><td style="padding:8px;font-weight:bold;color:#444">Travel Style:</td><td style="padding:8px;color:#222">${answers.style || 'Not specified'}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold;color:#444">Departing From:</td><td style="padding:8px;color:#222">${answers.departure || 'Not specified'}</td></tr>
                  <tr style="background:#fff"><td style="padding:8px;font-weight:bold;color:#444">Budget:</td><td style="padding:8px;color:#222">${answers.budget || 'Not specified'}</td></tr>
                </table>

                <h2 style="color:#0F2340;border-bottom:2px solid #1D9E75;padding-bottom:8px;margin-top:24px">📋 AI Generated Itinerary</h2>
                <div style="background:#fff;padding:16px;border-radius:8px;border-left:4px solid #1D9E75;white-space:pre-wrap;font-size:13px;line-height:1.7;color:#333">${itinerary || 'No itinerary generated'}</div>

                <div style="background:#E1F5EE;padding:16px;border-radius:8px;margin-top:20px;text-align:center">
                  <p style="margin:0;color:#1D6E50;font-weight:bold">⏰ Please contact this customer within 2 business hours</p>
                  <p style="margin:8px 0 0;color:#444">
                    📧 <a href="mailto:${email}">${email}</a> &nbsp;|&nbsp; 
                    📞 ${phone || 'No phone provided'} &nbsp;|&nbsp;
                    💬 <a href="https://wa.me/${phone ? phone.replace(/\D/g,'') : ''}">WhatsApp</a>
                  </p>
                </div>
              </div>
            </div>
          `
        };

        // Thank you email to customer
        const customerEmail = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: `✈️ Your ${answers.destination || 'Dream Trip'} Itinerary — Great Pacific Travels`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#0F2340;padding:24px;border-radius:10px 10px 0 0;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:24px">Great Pacific Travels</h1>
                <p style="color:#9FE1CB;margin:6px 0 0">Your Personal Travel Concierge</p>
              </div>

              <div style="background:#f8f9fa;padding:24px">
                <h2 style="color:#0F2340">Hi ${name.split(' ')[0]}! 🎉</h2>
                <p style="color:#444;line-height:1.7">Thank you for using our AI Trip Planner! We have received your enquiry and one of our travel specialists will contact you within <strong>2 business hours</strong> with a personalised quote.</p>

                <div style="background:#E1F5EE;border-left:4px solid #1D9E75;padding:14px;border-radius:0 8px 8px 0;margin:20px 0">
                  <p style="margin:0;color:#1D6E50;font-weight:bold">📋 Your Trip Summary</p>
                  <p style="margin:6px 0 0;color:#444">
                    🌍 <strong>Destination:</strong> ${answers.destination || 'Your dream destination'}<br/>
                    📅 <strong>Duration:</strong> ${answers.duration || 'To be confirmed'}<br/>
                    👥 <strong>Travellers:</strong> ${answers.travellers || 'To be confirmed'}<br/>
                    ✨ <strong>Style:</strong> ${answers.style || 'To be confirmed'}<br/>
                    ✈️ <strong>Departing:</strong> ${answers.departure || 'To be confirmed'}<br/>
                    💰 <strong>Budget:</strong> ${answers.budget || 'To be confirmed'}
                  </p>
                </div>

                <h3 style="color:#0F2340;border-bottom:2px solid #1D9E75;padding-bottom:6px">✈️ Your Personalised Itinerary</h3>
                <div style="background:#fff;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.7;color:#333">${itinerary || 'Your itinerary will be sent shortly'}</div>

                <div style="background:#0F2340;padding:20px;border-radius:8px;margin-top:24px;text-align:center">
                  <p style="color:#fff;margin:0;font-size:15px;font-weight:bold">Need to speak to us right now?</p>
                  <p style="color:#9FE1CB;margin:10px 0">
                    📞 <a href="tel:+611300844555" style="color:#5DCAA5">1300 844 555</a><br/>
                    💬 <a href="https://wa.me/61413231565" style="color:#5DCAA5">WhatsApp: 61413231565</a>
                  </p>
                  <p style="color:#7FD1B9;font-size:11px;margin:10px 0 0">ABN 46 600 388 609 | CATO Member | IATA TIDS Member</p>
                </div>
              </div>
            </div>
          `
        };

        // Send both emails
        await transporter.sendMail(teamEmail);
        await transporter.sendMail(customerEmail);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

      } catch (e) {
        console.error('Email error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Great Pacific Travels AI Planner running on port ${PORT}`);
});
