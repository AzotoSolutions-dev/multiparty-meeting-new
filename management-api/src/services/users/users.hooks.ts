import * as feathersAuthentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
import checkPermissions from 'feathers-permissions';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = feathersAuthentication.hooks;
const { hashPassword, protect } = local.hooks;

export default
{
	before :
	{
		all    : [],
		find   : [ authenticate('jwt'), checkPermissions({ roles: [ 'useradmin' ] }) ],
		get    : [ authenticate('jwt') ],
		create : [ hashPassword('password'), authenticate('jwt'), checkPermissions({ roles: [ 'useradmin' ] }) ],
		update : [ hashPassword('password'), authenticate('jwt'), checkPermissions({ roles: [ 'useradmin' ] }) ],
		patch  : [ hashPassword('password'), authenticate('jwt'), checkPermissions({ roles: [ 'useradmin' ] }) ],
		remove : [ authenticate('jwt'), checkPermissions({ roles: [ 'useradmin' ] }) ]
	},

	after :
	{
		all : [ 
			// Make sure the password field is never sent to the client
			// Always must be the last hook
			protect('password')
		],
		find   : [],
		get    : [],
		create : [],
		update : [],
		patch  : [],
		remove : []
	},

	error :
	{
		all    : [],
		find   : [],
		get    : [],
		create : [],
		update : [],
		patch  : [],
		remove : []
	}
};
