// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
import { Sequelize, DataTypes } from 'sequelize';
import { Application } from '../declarations';

// eslint-disable-next-line
export default (app: Application): any =>
{
	const sequelizeClient: Sequelize = app.get('sequelizeClient');
	const users = sequelizeClient.define('users', {
		email :
		{
			type      : DataTypes.STRING,
			allowNull : false,
			unique    : true
		},
		password :
		{
			type      : DataTypes.STRING,
			allowNull : false
		},
		auth0Id : { type: DataTypes.STRING }
	}, {
		hooks : {
			// eslint-disable-next-line
			beforeCount(options: any): void
			{
				options.raw = true;
			}
		}
	});

	// eslint-disable-next-line
	(users as any).associate = (models: any): void =>
	{
		// Define associations here
		// See http://docs.sequelizejs.com/en/latest/docs/associations/
	};

	return users;
};
