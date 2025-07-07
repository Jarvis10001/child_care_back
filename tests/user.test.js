const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../server'); // Adjust if needed
const expect = chai.expect;

chai.use(chaiHttp);

describe('User API', () => {
  it('should register a new user', (done) => {
    chai.request(server)
      .post('/api/users/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePass123',
        role: 'parent'
      })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('message').eql('User registered successfully');
        done();
      });
  });
});
